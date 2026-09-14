import type { ApiResult } from "../../../../../docs/contracts/ports";
import type {
  CashMovement,
  CashPaymentRequest,
  CommandContext,
  PaymentState,
} from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { toIsoTimestamp } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, StaffActor, StoredPayment } from "../../core/checkout/types";
import { validateCanonicalDef } from "../quotes/canonical-schema";

export async function confirmCash(input: {
  readonly store: CheckoutStore;
  readonly actor: StaffActor;
  readonly request: CashPaymentRequest;
  readonly context: CommandContext;
  readonly now: Date;
}): Promise<ApiResult<PaymentState>> {
  const { store, actor, request, context, now } = input;
  return store.withLock(`cash:${request.transactionId}`, async () => {
    const hash = await sha256Hex(canonicalJson(request));
    const claim = await store.claimIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey, hash);
    if (claim.kind === "conflict") {
      return apiFailure(
        "IDEMPOTENCY_CONFLICT",
        "Idempotency-Key was reused with a different cash request",
        context.correlationId,
      );
    }
    if (claim.kind === "in_progress") {
      return apiFailure("OPERATION_IN_PROGRESS", "cash confirmation is already in progress for this key", context.correlationId);
    }
    if (claim.kind === "replay" || claim.kind === "repair") {
      return replayPayment(claim.outcome, context.correlationId);
    }

    await store.markIdempotencySent(actor.organizationId, "payment.cash", context.idempotencyKey);

    const existing = await store.getPaymentForTransaction(request.transactionId);
    if (existing) {
      const state = toPaymentState(existing);
      await store.acknowledgeIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey, state);
      return { ok: true, data: state, correlationId: context.correlationId };
    }

    const sale = await store.getSale(request.transactionId);
    if (!sale) {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("NOT_FOUND", "prepared sale was not found", context.correlationId);
    }
    if (sale.organizationId !== actor.organizationId) {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("FORBIDDEN", "sale organization is out of staff scope", context.correlationId);
    }
    if (!actor.locationIds.includes(sale.locationId)) {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("FORBIDDEN", "sale location is out of staff scope", context.correlationId);
    }
    if (sale.status === "cancelled" || sale.status === "completed") {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("VALIDATION_ERROR", "sale cannot accept cash in its current state", context.correlationId);
    }
    if (sale.prepared.total.minor <= 0) {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("VALIDATION_ERROR", "prepared sale total must be positive for cash", context.correlationId);
    }
    if (request.cashReceived.currency !== sale.prepared.total.currency) {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("VALIDATION_ERROR", "cash received currency does not match the prepared sale", context.correlationId);
    }
    if (request.cashReceived.minor < sale.prepared.total.minor) {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("VALIDATION_ERROR", "cash received is less than the prepared sale total", context.correlationId);
    }

    const shift = await store.getShift(sale.shiftId);
    if (!shift || shift.status !== "open") {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("SHIFT_REQUIRED", "cash confirmation requires an open shift", context.correlationId);
    }
    if (shift.registerId !== sale.registerId || shift.locationId !== sale.locationId) {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("SHIFT_CONFLICT", "prepared sale is not bound to the open register shift", context.correlationId);
    }
    if (shift.openingFloat.currency !== sale.prepared.total.currency) {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("VALIDATION_ERROR", "shift currency does not match the prepared sale", context.correlationId);
    }

    const verifiedAt = toIsoTimestamp(now);
    const payment: StoredPayment = {
      paymentId: crypto.randomUUID(),
      transactionId: request.transactionId,
      saleId: sale.prepared.saleId,
      evidenceId: crypto.randomUUID(),
      tender: "cash",
      status: "verified",
      amount: sale.prepared.total,
      cashReceived: request.cashReceived,
      verifiedAt,
      verificationSource: "cash_ledger",
      actorId: actor.actorId,
    };
    const movement: CashMovement = {
      id: crypto.randomUUID(),
      shiftId: sale.shiftId,
      kind: "cash_sale",
      signedAmount: { minor: sale.prepared.total.minor, currency: sale.prepared.total.currency },
      actorId: actor.actorId,
      createdAt: verifiedAt,
      transactionId: request.transactionId,
      reason: "cash sale",
    };
    const appended = await store.appendCashMovement({ ...movement, organizationId: sale.organizationId });
    if (appended === "duplicate_sale") {
      const raced = await store.getPaymentForTransaction(request.transactionId);
      if (raced) {
        const state = toPaymentState(raced);
        await store.acknowledgeIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey, state);
        return { ok: true, data: state, correlationId: context.correlationId };
      }
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("REQUIRES_ATTENTION", "cash ledger already has a sale movement for this transaction", context.correlationId);
    }
    if (appended === "shift_required") {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("SHIFT_REQUIRED", "cash confirmation requires an open shift", context.correlationId);
    }
    if (appended !== "ok") {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("REQUIRES_ATTENTION", "cash ledger could not record the sale movement", context.correlationId);
    }

    await store.savePayment(payment);
    sale.status = "finalizing";
    sale.assignedPaymentId = payment.paymentId;
    await store.saveSale(sale);
    const state = toPaymentState(payment);
    if (!validateCanonicalDef("PaymentState", state)) {
      await store.releaseIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey);
      return apiFailure("INTEGRATION_UNAVAILABLE", "cash confirmation produced an invalid PaymentState", context.correlationId);
    }
    await store.acknowledgeIdempotency(actor.organizationId, "payment.cash", context.idempotencyKey, state);
    return { ok: true, data: state, correlationId: context.correlationId };
  });
}

function toPaymentState(payment: StoredPayment): PaymentState {
  return {
    transactionId: payment.transactionId,
    paymentId: payment.paymentId,
    tender: "cash",
    status: "verified",
    amount: payment.amount,
    verifiedAt: payment.verifiedAt,
    nextAction: "none",
  };
}

function replayPayment(outcome: unknown, correlationId: CommandContext["correlationId"]): ApiResult<PaymentState> {
  if (!validateCanonicalDef("PaymentState", outcome)) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "stored cash outcome is not a valid PaymentState", correlationId);
  }
  return { ok: true, data: outcome as PaymentState, correlationId };
}
