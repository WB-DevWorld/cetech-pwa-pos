import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type { CancelSaleRequest, CommandContext, SaleResolution } from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { apiFailure } from "../http/api-failure";
import { type CheckoutStore, type StaffActor } from "../../core/checkout/types";
import { isSaleResolution } from "./schema";
import { assertActorCanAccessSale } from "./transaction-scope";
import { resolutionFromRecord } from "./resolve-sale";

const UNSAFE_PAYMENT_STATUS = new Set([
  "verified",
  "pending",
  "reconciling",
  "awaiting_customer",
  "initializing",
  "requires_attention",
]);

export async function cancelSale(input: {
  readonly store: CheckoutStore;
  readonly salesPort: Pick<SalesPort, "cancel" | "resolve">;
  readonly actor: StaffActor;
  readonly request: CancelSaleRequest;
  readonly context: CommandContext;
}): Promise<ApiResult<SaleResolution>> {
  const { store, salesPort, actor, request, context } = input;
  return store.withLock(`cancel:${request.transactionId}`, async () => {
    const existing = await store.getSale(request.transactionId);
    if (!existing) {
      return apiFailure("NOT_FOUND", "prepared sale was not found", context.correlationId);
    }
    const access = assertActorCanAccessSale({
      sale: existing,
      actor,
      correlationId: context.correlationId,
    });
    if (!access.ok) {
      return access;
    }
    if (existing.status === "cancelled") {
      return { ok: true, data: resolutionFromRecord(existing), correlationId: context.correlationId };
    }
    const blocked = await cancelBlockedReason(store, existing, context.correlationId);
    if (blocked) {
      return blocked;
    }

    const hash = await sha256Hex(canonicalJson(request));
    const claim = await store.claimIdempotency(
      actor.organizationId,
      "sale.cancel",
      context.idempotencyKey,
      hash,
      existing.locationId,
      {
        registerId: existing.registerId,
        shiftId: existing.shiftId,
        transactionId: request.transactionId,
      },
    );
    if (claim.kind === "conflict") {
      return apiFailure(
        "IDEMPOTENCY_CONFLICT",
        "Idempotency-Key was reused with a different CancelSaleRequest",
        context.correlationId,
      );
    }
    if (claim.kind === "in_progress") {
      return apiFailure("OPERATION_IN_PROGRESS", "cancel is already in progress for this key", context.correlationId);
    }
    if (claim.kind === "replay") {
      return replayResolution(claim.outcome, context.correlationId);
    }

    await store.markIdempotencySent(actor.organizationId, "sale.cancel", context.idempotencyKey);
    try {
      const result = await completeCancel({ store, salesPort, actor, request, context, sale: existing });
      if (!result.ok) {
        if (result.error.nextAction === "resolve") {
          await store.markIdempotencyRequiresAttention(
            actor.organizationId,
            "sale.cancel",
            context.idempotencyKey,
            {
              transactionId: request.transactionId,
              status: "requires_attention",
              message: "Cancel result is unknown; resolve the existing transaction before retrying",
            },
          );
          return result;
        }
        await store.releaseIdempotency(actor.organizationId, "sale.cancel", context.idempotencyKey);
        return result;
      }
      await store.acknowledgeIdempotency(actor.organizationId, "sale.cancel", context.idempotencyKey, result.data);
      return result;
    } catch {
      let recovered: ApiResult<SaleResolution> | undefined;
      try {
        recovered = await salesPort.resolve(request.transactionId);
      } catch {
        recovered = undefined;
      }
      if (recovered?.ok && recovered.data.status === "cancelled") {
        const persisted = await persistCancelled(store, existing, recovered.data);
        await store.acknowledgeIdempotency(actor.organizationId, "sale.cancel", context.idempotencyKey, persisted);
        return { ok: true, data: persisted, correlationId: context.correlationId };
      }
      await store.markIdempotencyRequiresAttention(
        actor.organizationId,
        "sale.cancel",
        context.idempotencyKey,
        {
          transactionId: request.transactionId,
          status: "requires_attention",
          message: "Cancel result is unknown; resolve the existing transaction before retrying",
        },
      );
      return apiFailure(
        "INTEGRATION_UNAVAILABLE",
        "cancel result is unknown; resolve the existing transaction before starting another sale",
        context.correlationId,
      );
    }
  });
}

async function completeCancel(input: {
  readonly store: CheckoutStore;
  readonly salesPort: Pick<SalesPort, "cancel" | "resolve">;
  readonly actor: StaffActor;
  readonly request: CancelSaleRequest;
  readonly context: CommandContext;
  readonly sale: Awaited<ReturnType<CheckoutStore["getSale"]>> & object;
}): Promise<ApiResult<SaleResolution>> {
  const sale = await input.store.getSale(input.request.transactionId);
  if (!sale) {
    return apiFailure("NOT_FOUND", "prepared sale was not found", input.context.correlationId);
  }
  const blocked = await cancelBlockedReason(input.store, sale, input.context.correlationId);
  if (blocked) {
    return blocked;
  }
  const commercial = await input.salesPort.cancel(input.request, input.context);
  if (!commercial.ok) {
    return commercial;
  }
  if (!isSaleResolution(commercial.data)) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "bridge returned an invalid SaleResolution", input.context.correlationId);
  }
  if (commercial.data.status === "cancelled") {
    const persisted = await persistCancelled(input.store, sale, commercial.data);
    return { ok: true, data: persisted, correlationId: input.context.correlationId };
  }
  if (commercial.data.status === "requires_attention" || commercial.data.status === "payment_pending") {
    sale.status = commercial.data.status === "payment_pending" ? "payment_pending" : "requires_attention";
    await input.store.saveSale(sale);
    return { ok: true, data: commercial.data, correlationId: input.context.correlationId };
  }
  return commercial;
}

async function cancelBlockedReason(
  store: CheckoutStore,
  sale: NonNullable<Awaited<ReturnType<CheckoutStore["getSale"]>>>,
  correlationId: string,
): Promise<ApiResult<SaleResolution> | undefined> {
  if (sale.status === "completed" || sale.commercialConfirmed) {
    return apiFailure("PAYMENT_PENDING", "A verified sale cannot be cancelled", correlationId);
  }
  if (sale.status === "finalizing" || sale.status === "requires_attention") {
    return apiFailure("PAYMENT_PENDING", "This sale cannot be cancelled in its current state", correlationId);
  }
  const payment = sale.assignedPaymentId
    ? await store.getPayment(sale.assignedPaymentId)
    : await store.getPaymentForTransaction(sale.prepared.transactionId);
  if (payment && UNSAFE_PAYMENT_STATUS.has(payment.status)) {
    return apiFailure("PAYMENT_PENDING", "A payment is already in progress for this sale", correlationId);
  }
  return undefined;
}

async function persistCancelled(
  store: CheckoutStore,
  sale: NonNullable<Awaited<ReturnType<CheckoutStore["getSale"]>>>,
  resolution: SaleResolution,
): Promise<SaleResolution> {
  sale.status = "cancelled";
  await store.saveSale(sale);
  return {
    transactionId: sale.prepared.transactionId,
    status: "cancelled",
    saleId: resolution.saleId ?? sale.prepared.saleId,
    orderReference: resolution.orderReference ?? sale.prepared.orderReference,
    paymentId: resolution.paymentId,
    message: resolution.message,
  };
}

function replayResolution(outcome: unknown, correlationId: string): ApiResult<SaleResolution> {
  if (isSaleResolution(outcome)) {
    return { ok: true, data: outcome, correlationId };
  }
  return apiFailure("INTEGRATION_UNAVAILABLE", "stored cancel outcome is invalid", correlationId);
}
