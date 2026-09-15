import type { ApiResult, BridgeReturnEffectsPort } from "../../../../../docs/contracts/ports";
import type {
  CommandContext,
  ReturnExecuteRequest,
  ReturnResolution,
} from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { toIsoTimestamp } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, StaffActor } from "../../core/checkout/types";
import { monotonicIndependent } from "../../core/returns/aggregate";
import { stockCommandLines, stockEffectRequired } from "../../core/returns/disposition";
import type { ReturnStore, StoredReturnRecord } from "../../core/returns/types";
import { refundTender, resolveTenderRefund } from "../payments/refund";
import type { ElectronicRefundProvider } from "../payments/refund-provider";
import { resolutionFromRecord } from "./resolution";

const PREVIEW_STATUSES = new Set(["previewed", "approval_required"]);

export async function executeReturn(input: {
  readonly checkoutStore: CheckoutStore;
  readonly returnStore: ReturnStore;
  readonly provider: ElectronicRefundProvider;
  readonly bridge: BridgeReturnEffectsPort;
  readonly actor: StaffActor;
  readonly request: ReturnExecuteRequest;
  readonly context: CommandContext;
  readonly now: Date;
}): Promise<ApiResult<ReturnResolution>> {
  const stored = await input.returnStore.getReturn(input.request.returnId);
  if (!stored) {
    return apiFailure("NOT_FOUND", "return was not found", input.context.correlationId);
  }
  if (stored.organizationId !== input.actor.organizationId || !input.actor.locationIds.includes(stored.locationId)) {
    return apiFailure("FORBIDDEN", "return is outside staff scope", input.context.correlationId);
  }
  if (stored.fingerprint !== input.request.fingerprint) {
    return apiFailure("VALIDATION_ERROR", "return fingerprint does not match the durable preview", input.context.correlationId);
  }
  if (Date.parse(stored.previewExpiresAt) <= input.now.getTime()) {
    return apiFailure("VALIDATION_ERROR", "return preview has expired", input.context.correlationId);
  }
  if (stored.approvalRequired) {
    const approved = await validateApproval(input.returnStore, stored, input.request, input.now, input.context.correlationId);
    if (!approved.ok) {
      return approved;
    }
  }

  const hash = await sha256Hex(canonicalJson(input.request));
  const claim = await input.checkoutStore.claimIdempotency(
    stored.organizationId,
    "return.execute",
    input.context.idempotencyKey,
    hash,
    stored.locationId,
    { registerId: stored.registerId, shiftId: stored.shiftId, transactionId: stored.transactionId },
  );
  if (claim.kind === "conflict") {
    return apiFailure(
      "IDEMPOTENCY_CONFLICT",
      "Idempotency-Key was reused with a different ReturnExecuteRequest",
      input.context.correlationId,
    );
  }
  if (claim.kind === "in_progress") {
    const latest = await input.returnStore.getReturn(input.request.returnId);
    if (!latest?.executeClaimedAt) {
      return apiFailure("OPERATION_IN_PROGRESS", "return execute is already in progress for this key", input.context.correlationId);
    }
  }
  if (claim.kind === "replay") {
    const replayed = await input.returnStore.getReturn(input.request.returnId);
    if (replayed) {
      return { ok: true, data: resolutionFromRecord(replayed), correlationId: input.context.correlationId };
    }
  }

  await input.checkoutStore.markIdempotencySent(stored.organizationId, "return.execute", input.context.idempotencyKey);

  const claimed = await input.returnStore.withLock(
    `return-execute:${stored.organizationId}:${stored.saleId}`,
    async () => input.returnStore.claimExecution(stored.returnId, toIsoTimestamp(input.now)),
  );
  if (claimed === "missing") {
    await input.checkoutStore.releaseIdempotency(stored.organizationId, "return.execute", input.context.idempotencyKey);
    return apiFailure("NOT_FOUND", "return was not found", input.context.correlationId);
  }
  if (claimed === "quantity_exceeded") {
    await input.checkoutStore.releaseIdempotency(stored.organizationId, "return.execute", input.context.idempotencyKey);
    return apiFailure("VALIDATION_ERROR", "remaining returnable quantity is insufficient", input.context.correlationId);
  }
  if (claimed === "refund_exceeded") {
    await input.checkoutStore.releaseIdempotency(stored.organizationId, "return.execute", input.context.idempotencyKey);
    return apiFailure("VALIDATION_ERROR", "remaining refundable tender is insufficient", input.context.correlationId);
  }

  const latest = await input.returnStore.getReturn(stored.returnId);
  if (!latest) {
    await input.checkoutStore.releaseIdempotency(stored.organizationId, "return.execute", input.context.idempotencyKey);
    return apiFailure("NOT_FOUND", "return was not found", input.context.correlationId);
  }
  const allocated = await allocateEffects(latest, input.returnStore);
  await runRequiredEffects({
    checkoutStore: input.checkoutStore,
    returnStore: input.returnStore,
    provider: input.provider,
    bridge: input.bridge,
    actor: input.actor,
    stored: allocated,
    context: input.context,
    now: input.now,
    applyRemote: claimed === "claimed" || PREVIEW_STATUSES.has(allocated.status),
  });
  const finished = await input.returnStore.getReturn(stored.returnId);
  if (!finished) {
    return apiFailure("NOT_FOUND", "return was not found", input.context.correlationId);
  }
  const resolution = resolutionFromRecord(finished);
  finished.status = resolution.status;
  await input.returnStore.saveReturn(finished);
  await input.checkoutStore.acknowledgeIdempotency(
    stored.organizationId,
    "return.execute",
    input.context.idempotencyKey,
    resolution,
  );
  await input.returnStore.appendAudit({
    id: crypto.randomUUID(),
    returnId: stored.returnId,
    organizationId: stored.organizationId,
    eventType: "return.executed",
    payload: { status: resolution.status },
    createdAt: toIsoTimestamp(input.now),
  });
  return { ok: true, data: resolution, correlationId: input.context.correlationId };
}

async function validateApproval(
  store: ReturnStore,
  stored: StoredReturnRecord,
  request: ReturnExecuteRequest,
  now: Date,
  correlationId: string,
): Promise<ApiResult<true>> {
  if (!request.approvalId) {
    return apiFailure("FORBIDDEN", "manager approval is required", correlationId);
  }
  const approval = await store.getApproval(request.approvalId);
  if (!approval) {
    return apiFailure("FORBIDDEN", "approval was not found", correlationId);
  }
  if (approval.returnId !== stored.returnId || approval.fingerprint !== stored.fingerprint) {
    return apiFailure("FORBIDDEN", "approval is not bound to this return fingerprint", correlationId);
  }
  if (Date.parse(approval.expiresAt) <= now.getTime()) {
    return apiFailure("FORBIDDEN", "approval has expired", correlationId);
  }
  return { ok: true, data: true, correlationId };
}

async function allocateEffects(stored: StoredReturnRecord, returnStore: ReturnStore): Promise<StoredReturnRecord> {
  const tender = stored.historicTenders[0];
  const moneyRequired = stored.refundTotal.minor > 0 && Boolean(tender);
  const cashRequired = moneyRequired && tender?.tender === "cash";
  const providerRequired = moneyRequired && tender?.tender !== "cash";
  const stockRequired = stockEffectRequired(stored.requestedLines);

  if (cashRequired && !stored.cashRefund) {
    stored.cashRefund = {
      refundId: crypto.randomUUID(),
      returnId: stored.returnId,
      channel: "cash_ledger",
      status: "pending",
      amount: stored.refundTotal,
      organizationId: stored.organizationId,
      locationId: stored.locationId,
      paymentId: tender!.paymentId,
      transactionId: stored.transactionId,
    };
  }
  if (providerRequired && !stored.providerRefund) {
    stored.providerRefund = {
      refundId: crypto.randomUUID(),
      returnId: stored.returnId,
      channel: "provider_electronic",
      status: "pending",
      amount: stored.refundTotal,
      organizationId: stored.organizationId,
      locationId: stored.locationId,
      paymentId: tender!.paymentId,
      transactionId: stored.transactionId,
    };
  }
  if (!stored.commercialRefund) {
    stored.commercialRefund = {
      commercialRefundId: crypto.randomUUID(),
      returnId: stored.returnId,
      organizationId: stored.organizationId,
      locationId: stored.locationId,
      transactionId: stored.transactionId,
      saleId: stored.saleId,
      amount: stored.refundTotal,
      economicsVersion: stored.economicsVersion,
      fingerprint: stored.fingerprint,
      status: "pending",
    };
    await returnStore.insertCommercialRefund(stored.commercialRefund);
  }
  if (stockRequired && !stored.stockDisposition) {
    stored.stockDisposition = {
      stockDispositionId: crypto.randomUUID(),
      returnId: stored.returnId,
      organizationId: stored.organizationId,
      locationId: stored.locationId,
      transactionId: stored.transactionId,
      saleId: stored.saleId,
      economicsVersion: stored.economicsVersion,
      fingerprint: stored.fingerprint,
      status: "pending",
    };
    await returnStore.insertStockDisposition(stored.stockDisposition);
  }
  await returnStore.saveReturn(stored);
  return stored;
}

async function runRequiredEffects(input: {
  readonly checkoutStore: CheckoutStore;
  readonly returnStore: ReturnStore;
  readonly provider: ElectronicRefundProvider;
  readonly bridge: BridgeReturnEffectsPort;
  readonly actor: StaffActor;
  readonly stored: StoredReturnRecord;
  readonly context: CommandContext;
  readonly now: Date;
  readonly applyRemote: boolean;
}): Promise<void> {
  const refundTarget = input.stored.cashRefund ?? input.stored.providerRefund;
  if (refundTarget && refundTarget.status !== "verified") {
    const existing = await input.returnStore.getTenderRefund(refundTarget.refundId);
    if (existing) {
      await resolveTenderRefund({
        checkoutStore: input.checkoutStore,
        returnStore: input.returnStore,
        provider: input.provider,
        actor: input.actor,
        refundId: refundTarget.refundId,
        correlationId: input.context.correlationId,
        now: input.now,
      });
    } else {
      await refundTender({
        checkoutStore: input.checkoutStore,
        returnStore: input.returnStore,
        provider: input.provider,
        actor: input.actor,
        request: {
          refundId: refundTarget.refundId,
          returnId: input.stored.returnId,
          paymentId: refundTarget.paymentId,
          transactionId: input.stored.transactionId,
          channel: refundTarget.channel,
          amount: refundTarget.amount,
        },
        context: {
          idempotencyKey: refundTarget.refundId,
          correlationId: input.context.correlationId,
        },
        now: input.now,
      });
    }
  }

  const commercial = await input.returnStore.getCommercialRefund(input.stored.commercialRefund?.commercialRefundId ?? "");
  if (commercial && commercial.status !== "completed") {
    if (input.applyRemote && (commercial.status === "pending" || commercial.status === "not_started")) {
      const applied = await input.bridge.applyCommercialRefund(
        {
          commercialRefundId: commercial.commercialRefundId,
          returnId: commercial.returnId,
          transactionId: commercial.transactionId,
          saleId: commercial.saleId,
          amount: commercial.amount,
          economicsVersion: commercial.economicsVersion,
          fingerprint: input.stored.fingerprint,
          reason: input.stored.requestedLines[0]?.reason ?? "return",
          lineAllocations: input.stored.requestedLines.map((line) => ({
            orderLineId: line.orderLineId,
            quantity: line.quantity,
            historicAmount: input.stored.historicLines.find((historic) => historic.orderLineId === line.orderLineId)?.historicalTotal ?? input.stored.refundTotal,
          })),
        },
        input.context,
      );
      if (applied.ok) {
        await input.returnStore.saveCommercialRefund({
          ...commercial,
          status: monotonicIndependent(commercial.status, applied.data.status),
          message: applied.data.message,
        });
      } else {
        await input.returnStore.saveCommercialRefund({
          ...commercial,
          status: monotonicIndependent(commercial.status, "pending"),
          message: applied.error.message,
        });
      }
    } else {
      const resolved = await input.bridge.resolveCommercialRefund(commercial.commercialRefundId);
      if (resolved.ok) {
        await input.returnStore.saveCommercialRefund({
          ...commercial,
          status: monotonicIndependent(commercial.status, resolved.data.status),
          message: resolved.data.message,
        });
      }
    }
  }

  const stock = input.stored.stockDisposition
    ? await input.returnStore.getStockDisposition(input.stored.stockDisposition.stockDispositionId)
    : undefined;
  if (stock && stock.status !== "completed") {
    if (input.applyRemote && (stock.status === "pending" || stock.status === "not_started")) {
      const applied = await input.bridge.applyStockDisposition(
        {
          stockDispositionId: stock.stockDispositionId,
          returnId: stock.returnId,
          transactionId: stock.transactionId,
          saleId: stock.saleId,
          economicsVersion: stock.economicsVersion,
          fingerprint: input.stored.fingerprint,
          lines: stockCommandLines({
            locationId: input.stored.locationId,
            lines: input.stored.requestedLines,
          }),
        },
        input.context,
      );
      if (applied.ok) {
        await input.returnStore.saveStockDisposition({
          ...stock,
          status: monotonicIndependent(stock.status, applied.data.status),
          message: applied.data.message,
        });
      } else {
        await input.returnStore.saveStockDisposition({
          ...stock,
          status: monotonicIndependent(stock.status, "pending"),
          message: applied.error.message,
        });
      }
    } else {
      const resolved = await input.bridge.resolveStockDisposition(stock.stockDispositionId);
      if (resolved.ok) {
        await input.returnStore.saveStockDisposition({
          ...stock,
          status: monotonicIndependent(stock.status, resolved.data.status),
          message: resolved.data.message,
        });
      }
    }
  }
}
