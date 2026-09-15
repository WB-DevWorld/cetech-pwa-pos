import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type {
  CommandContext,
  PreparedSale,
  PrepareSaleRequest,
  Quote,
  ReceiptLine,
} from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { toIsoTimestamp } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import { moneyEqual, type CheckoutStore, type StaffActor } from "../../core/checkout/types";
import { isPreparedSale } from "./schema";

export async function prepareSale(input: {
  readonly store: CheckoutStore;
  readonly salesPort: Pick<SalesPort, "prepare" | "resolve">;
  readonly actor: StaffActor;
  readonly request: PrepareSaleRequest;
  readonly context: CommandContext;
  readonly now: Date;
}): Promise<ApiResult<PreparedSale>> {
  const { store, salesPort, actor, request, context, now } = input;
  return store.withLock(`prepare:${request.transactionId}`, async () => {
    const hash = await sha256Hex(canonicalJson(request));
    const claim = await store.claimIdempotency(actor.organizationId, "sale.prepare", context.idempotencyKey, hash);
    if (claim.kind === "conflict") {
      return apiFailure(
        "IDEMPOTENCY_CONFLICT",
        "Idempotency-Key was reused with a different PrepareSaleRequest",
        context.correlationId,
      );
    }
    if (claim.kind === "in_progress") {
      return apiFailure("OPERATION_IN_PROGRESS", "prepare is already in progress for this key", context.correlationId);
    }
    if (claim.kind === "replay") {
      return replayPrepared(claim.outcome, context.correlationId);
    }

    await store.markIdempotencySent(actor.organizationId, "sale.prepare", context.idempotencyKey);
    try {
      const result = await completePrepare({ store, salesPort, actor, request, context, now });
      if (!result.ok) {
        await store.releaseIdempotency(actor.organizationId, "sale.prepare", context.idempotencyKey);
        return result;
      }
      await store.acknowledgeIdempotency(actor.organizationId, "sale.prepare", context.idempotencyKey, result.data);
      return result;
    } catch {
      let recovered: ApiResult<PreparedSale> | undefined;
      try {
        recovered = await recoverPrepared({ store, salesPort, actor, request, context, now });
      } catch {
        recovered = undefined;
      }
      if (recovered?.ok) {
        await store.acknowledgeIdempotency(actor.organizationId, "sale.prepare", context.idempotencyKey, recovered.data);
        return recovered;
      }
      await store.markIdempotencyRequiresAttention(
        actor.organizationId,
        "sale.prepare",
        context.idempotencyKey,
        {
          transactionId: request.transactionId,
          status: "requires_attention",
          message: "Prepare result is unknown; resolve the existing transaction before retrying",
        },
      );
      return apiFailure(
        "INTEGRATION_UNAVAILABLE",
        "prepare result is unknown; resolve the existing transaction before creating another order",
        context.correlationId,
      );
    }
  });
}

async function completePrepare(input: {
  readonly store: CheckoutStore;
  readonly salesPort: Pick<SalesPort, "prepare" | "resolve">;
  readonly actor: StaffActor;
  readonly request: PrepareSaleRequest;
  readonly context: CommandContext;
  readonly now: Date;
}): Promise<ApiResult<PreparedSale>> {
  const existing = await input.store.getSale(input.request.transactionId);
  if (existing) {
    if (existing.prepared.quoteFingerprint !== input.request.quoteFingerprint) {
      return apiFailure(
        "REQUIRES_ATTENTION",
        "This transaction already has a prepared sale with a different quote",
        input.context.correlationId,
      );
    }
    return { ok: true, data: existing.prepared, correlationId: input.context.correlationId };
  }

  const scoped = await assertPrepareScope(input);
  if (!scoped.ok) {
    return scoped;
  }
  const quote = scoped.data.quote;

  const commercial = await input.salesPort.prepare(input.request, input.context);
  if (!commercial.ok) {
    return commercial;
  }
  if (!isPreparedSale(commercial.data)) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "bridge returned an invalid PreparedSale", input.context.correlationId);
  }
  if (!moneyEqual(commercial.data.total, quote.total)) {
    return apiFailure(
      "INTEGRATION_UNAVAILABLE",
      "bridge PreparedSale total does not match the stored authoritative quote",
      input.context.correlationId,
    );
  }
  return persistPrepared({
    store: input.store,
    actor: input.actor,
    request: input.request,
    prepared: commercial.data,
    quote,
    context: input.context,
  });
}

async function recoverPrepared(input: {
  readonly store: CheckoutStore;
  readonly salesPort: Pick<SalesPort, "prepare" | "resolve">;
  readonly actor: StaffActor;
  readonly request: PrepareSaleRequest;
  readonly context: CommandContext;
  readonly now: Date;
}): Promise<ApiResult<PreparedSale>> {
  const local = await input.store.getSale(input.request.transactionId);
  if (local) {
    return { ok: true, data: local.prepared, correlationId: input.context.correlationId };
  }
  const resolved = await input.salesPort.resolve(input.request.transactionId);
  if (!resolved.ok) {
    return resolved;
  }
  if (resolved.data.status !== "prepared" && resolved.data.status !== "finalizing" && resolved.data.status !== "completed") {
    return apiFailure(
      "INTEGRATION_UNAVAILABLE",
      resolved.data.message ?? "prepared sale could not be recovered after a lost response",
      input.context.correlationId,
    );
  }
  const scoped = await assertPrepareScope(input);
  if (!scoped.ok) {
    return scoped;
  }
  const quote = scoped.data.quote;
  const prepared: PreparedSale = {
    transactionId: input.request.transactionId,
    saleId: resolved.data.saleId ?? `recovered-${input.request.transactionId.slice(0, 8)}`,
    orderReference: resolved.data.orderReference ?? resolved.data.saleId ?? input.request.transactionId,
    quoteFingerprint: input.request.quoteFingerprint,
    total: quote.total,
    status: "prepared",
    stockCommitment: "reserved",
    preparedAt: toIsoTimestamp(input.now),
    expiresAt: quote.expiresAt,
  };
  if (!isPreparedSale(prepared)) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "recovered PreparedSale is invalid", input.context.correlationId);
  }
  return persistPrepared({
    store: input.store,
    actor: input.actor,
    request: input.request,
    prepared,
    quote,
    context: input.context,
  });
}

async function assertPrepareScope(input: {
  readonly store: CheckoutStore;
  readonly actor: StaffActor;
  readonly request: PrepareSaleRequest;
  readonly context: CommandContext;
  readonly now: Date;
}): Promise<ApiResult<{ quote: Quote }>> {
  const quote = await input.store.getQuote(input.request.quoteId);
  if (!quote) {
    return apiFailure("NOT_FOUND", "quote snapshot was not found", input.context.correlationId);
  }
  if (quote.fingerprint !== input.request.quoteFingerprint) {
    return apiFailure("QUOTE_CHANGED", "quoteFingerprint does not match the stored quote", input.context.correlationId);
  }
  if (Date.parse(quote.expiresAt) <= input.now.getTime()) {
    return apiFailure("QUOTE_EXPIRED", "Quote has expired", input.context.correlationId);
  }
  if (!quote.purchasable) {
    return apiFailure("STOCK_CHANGED", "quoted items are not purchasable", input.context.correlationId);
  }
  if (!input.actor.locationIds.includes(quote.locationId)) {
    return apiFailure("FORBIDDEN", "quote location is out of staff scope", input.context.correlationId);
  }
  const register = await input.store.getRegister(input.request.registerId);
  if (!register || register.status !== "active") {
    return apiFailure("NOT_FOUND", "register is not available", input.context.correlationId);
  }
  if (register.organizationId !== input.actor.organizationId || register.locationId !== quote.locationId) {
    return apiFailure("FORBIDDEN", "register is out of quote location scope", input.context.correlationId);
  }
  const shift = await input.store.getShift(input.request.shiftId);
  if (!shift || shift.status !== "open") {
    return apiFailure("SHIFT_REQUIRED", "prepare requires an open shift", input.context.correlationId);
  }
  if (shift.registerId !== register.id || shift.deviceId !== input.request.deviceId) {
    return apiFailure("VALIDATION_ERROR", "shift does not match the register and device", input.context.correlationId);
  }
  const device = await input.store.getDevice(input.request.deviceId);
  if (!device || device.status !== "active" || device.locationId !== register.locationId) {
    return apiFailure("VALIDATION_ERROR", "device is not at the register location", input.context.correlationId);
  }
  return { ok: true, data: { quote }, correlationId: input.context.correlationId };
}

async function persistPrepared(input: {
  readonly store: CheckoutStore;
  readonly actor: StaffActor;
  readonly request: PrepareSaleRequest;
  readonly prepared: PreparedSale;
  readonly quote: Quote;
  readonly context: CommandContext;
}): Promise<ApiResult<PreparedSale>> {
  const existing = await input.store.getSale(input.request.transactionId);
  if (existing) {
    return { ok: true, data: existing.prepared, correlationId: input.context.correlationId };
  }
  const register = await input.store.getRegister(input.request.registerId);
  if (!register) {
    return apiFailure("NOT_FOUND", "register is not available", input.context.correlationId);
  }
  await input.store.seedPreparedSale({
    organizationId: input.actor.organizationId,
    locationId: register.locationId,
    locationName: register.locationId,
    registerId: register.id,
    registerName: register.name,
    deviceId: input.request.deviceId,
    shiftId: input.request.shiftId,
    cashierId: input.actor.actorId,
    cashierName: input.actor.displayName,
    customer: input.quote.customer,
    customerLabel: customerLabel(input.quote),
    prepared: input.prepared,
    lines: receiptLinesFromQuote(input.quote),
    subtotal: input.quote.subtotal,
    discount: input.quote.discount,
    tax: input.quote.tax,
  });
  return { ok: true, data: input.prepared, correlationId: input.context.correlationId };
}

export function receiptLinesFromQuote(quote: Quote): readonly ReceiptLine[] {
  return quote.lines.map((line) => ({
    name: line.productId,
    ...(line.variationId ? { variationLabel: line.variationId } : {}),
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    subtotal: line.subtotal,
    discount: line.discount,
    tax: line.tax,
    total: line.total,
  }));
}

export function customerLabel(quote: Quote): string {
  return quote.customer.kind === "walkin" ? "Walk-in" : quote.customer.customerId;
}

function replayPrepared(outcome: unknown, correlationId: CommandContext["correlationId"]): ApiResult<PreparedSale> {
  if (!isPreparedSale(outcome)) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "stored prepare outcome is not a valid PreparedSale", correlationId);
  }
  return { ok: true, data: outcome, correlationId };
}
