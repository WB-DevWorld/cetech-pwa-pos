import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { CommandContext, RefundRequest, RefundState } from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { toIsoTimestamp } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, StaffActor, StoredCashMovement } from "../../core/checkout/types";
import { moneyEqual } from "../../core/checkout/types";
import { monotonicRefund } from "../../core/returns/aggregate";
import type { ReturnStore, StoredTenderRefund } from "../../core/returns/types";
import type { ElectronicRefundProvider, ProviderRefundResolveResult } from "./refund-provider";

export async function refundTender(input: {
  readonly checkoutStore: CheckoutStore;
  readonly returnStore: ReturnStore;
  readonly provider: ElectronicRefundProvider;
  readonly actor: StaffActor;
  readonly request: RefundRequest;
  readonly context: CommandContext;
  readonly now: Date;
}): Promise<ApiResult<RefundState>> {
  const storedReturn = await input.returnStore.getReturn(input.request.returnId);
  if (!storedReturn) {
    return apiFailure("NOT_FOUND", "return was not found", input.context.correlationId);
  }
  if (
    storedReturn.organizationId !== input.actor.organizationId ||
    !input.actor.locationIds.includes(storedReturn.locationId)
  ) {
    return apiFailure("FORBIDDEN", "return is outside staff scope", input.context.correlationId);
  }
  const tender = storedReturn.historicTenders.find((row) => row.paymentId === input.request.paymentId);
  if (!tender) {
    return apiFailure("VALIDATION_ERROR", "refund payment is not the historic tender", input.context.correlationId);
  }
  if (!moneyEqual(input.request.amount, storedReturn.refundTotal)) {
    return apiFailure("VALIDATION_ERROR", "refund amount must copy historic economics", input.context.correlationId);
  }
  const expectedChannel = tender.tender === "cash" ? "cash_ledger" : "provider_electronic";
  if (input.request.channel !== expectedChannel) {
    return apiFailure("VALIDATION_ERROR", "refund channel does not match historic tender", input.context.correlationId);
  }

  const hash = await sha256Hex(canonicalJson(input.request));
  const claim = await input.checkoutStore.claimIdempotency(
    storedReturn.organizationId,
    "payment.refund",
    input.context.idempotencyKey,
    hash,
    storedReturn.locationId,
    { registerId: storedReturn.registerId, shiftId: storedReturn.shiftId, transactionId: storedReturn.transactionId },
  );
  if (claim.kind === "conflict") {
    return apiFailure("IDEMPOTENCY_CONFLICT", "Idempotency-Key was reused with a different RefundRequest", input.context.correlationId);
  }
  if (claim.kind === "in_progress") {
    return apiFailure("OPERATION_IN_PROGRESS", "refund is already in progress for this key", input.context.correlationId);
  }
  if (claim.kind === "replay" && isRefundState(claim.outcome)) {
    return { ok: true, data: claim.outcome, correlationId: input.context.correlationId };
  }

  const existing = await input.returnStore.getTenderRefund(input.request.refundId);
  if (existing) {
    if (existing.returnId !== input.request.returnId || existing.paymentId !== input.request.paymentId) {
      return apiFailure("IDEMPOTENCY_CONFLICT", "refundId is bound to a different return", input.context.correlationId);
    }
    const resolved = await reconcileTenderRefund({
      checkoutStore: input.checkoutStore,
      returnStore: input.returnStore,
      provider: input.provider,
      actor: input.actor,
      refund: existing,
      now: input.now,
      correlationId: input.context.correlationId,
    });
    if (resolved.ok) {
      await input.checkoutStore.acknowledgeIdempotency(
        storedReturn.organizationId,
        "payment.refund",
        input.context.idempotencyKey,
        resolved.data,
      );
    }
    return resolved;
  }

  await input.checkoutStore.markIdempotencySent(storedReturn.organizationId, "payment.refund", input.context.idempotencyKey);
  const pending: StoredTenderRefund = {
    refundId: input.request.refundId,
    returnId: input.request.returnId,
    channel: input.request.channel,
    status: "pending",
    amount: input.request.amount,
    organizationId: storedReturn.organizationId,
    locationId: storedReturn.locationId,
    paymentId: input.request.paymentId,
    transactionId: input.request.transactionId,
    initializeStatus: "pending_remote",
  };
  const inserted = await input.returnStore.insertTenderRefund(pending);
  if (inserted === "duplicate") {
    const duplicate = await input.returnStore.getTenderRefund(input.request.refundId);
    if (duplicate) {
      return { ok: true, data: toRefundState(duplicate), correlationId: input.context.correlationId };
    }
  }

  const applied =
    input.request.channel === "cash_ledger"
      ? await applyCashRefund({
          checkoutStore: input.checkoutStore,
          returnStore: input.returnStore,
          actor: input.actor,
          storedReturn,
          refund: pending,
          now: input.now,
          correlationId: input.context.correlationId,
        })
      : await applyProviderRefund({
          returnStore: input.returnStore,
          checkoutStore: input.checkoutStore,
          provider: input.provider,
          refund: pending,
          correlationId: input.context.correlationId,
        });
  if (applied.ok) {
    await input.checkoutStore.acknowledgeIdempotency(
      storedReturn.organizationId,
      "payment.refund",
      input.context.idempotencyKey,
      applied.data,
    );
  } else if (applied.error.code === "INTEGRATION_UNAVAILABLE") {
    await input.checkoutStore.markIdempotencyRequiresAttention(
      storedReturn.organizationId,
      "payment.refund",
      input.context.idempotencyKey,
      pending,
    );
  } else {
    await input.checkoutStore.releaseIdempotency(
      storedReturn.organizationId,
      "payment.refund",
      input.context.idempotencyKey,
    );
  }
  return applied;
}

export async function resolveTenderRefund(input: {
  readonly checkoutStore: CheckoutStore;
  readonly returnStore: ReturnStore;
  readonly provider: ElectronicRefundProvider;
  readonly actor: StaffActor;
  readonly refundId: string;
  readonly correlationId: string;
  readonly now: Date;
}): Promise<ApiResult<RefundState>> {
  const refund = await input.returnStore.getTenderRefund(input.refundId);
  if (!refund) {
    return apiFailure("NOT_FOUND", "refund was not found", input.correlationId);
  }
  if (refund.organizationId !== input.actor.organizationId || !input.actor.locationIds.includes(refund.locationId)) {
    return apiFailure("FORBIDDEN", "refund is outside staff scope", input.correlationId);
  }
  return reconcileTenderRefund({
    checkoutStore: input.checkoutStore,
    returnStore: input.returnStore,
    provider: input.provider,
    actor: input.actor,
    refund,
    now: input.now,
    correlationId: input.correlationId,
  });
}

async function applyCashRefund(input: {
  readonly checkoutStore: CheckoutStore;
  readonly returnStore: ReturnStore;
  readonly actor: StaffActor;
  readonly storedReturn: {
    readonly organizationId: string;
    readonly locationId: string;
    readonly registerId: string;
    readonly shiftId?: string;
    readonly transactionId: string;
  };
  readonly refund: StoredTenderRefund;
  readonly now: Date;
  readonly correlationId: string;
}): Promise<ApiResult<RefundState>> {
  const shift = input.storedReturn.shiftId
    ? await input.checkoutStore.getActiveShift(input.storedReturn.registerId)
    : undefined;
  if (!shift || shift.id !== input.storedReturn.shiftId) {
    return persistRefund(input.returnStore, {
      ...input.refund,
      status: "requires_attention",
      attentionReason: "open shift is required for cash refund",
    }, input.correlationId);
  }
  if (shift.organizationId !== input.storedReturn.organizationId || shift.locationId !== input.storedReturn.locationId) {
    return apiFailure("FORBIDDEN", "register shift is outside return scope", input.correlationId);
  }
  const movement: StoredCashMovement = {
    id: crypto.randomUUID(),
    organizationId: input.storedReturn.organizationId,
    shiftId: shift.id,
    kind: "cash_refund",
    signedAmount: { minor: -input.refund.amount.minor, currency: input.refund.amount.currency },
    actorId: input.actor.actorId,
    createdAt: toIsoTimestamp(input.now),
    transactionId: input.storedReturn.transactionId,
    reason: "return cash refund",
    refundId: input.refund.refundId,
  };
  const appended = await input.checkoutStore.appendCashMovement(movement);
  if (appended === "duplicate_refund") {
    const existing = await input.checkoutStore.listCashRefunds(input.refund.refundId);
    const row = existing[0];
    return persistRefund(input.returnStore, {
      ...input.refund,
      status: "verified",
      cashMovementId: row?.id,
      initializeStatus: "initialized",
    }, input.correlationId);
  }
  if (appended === "shift_required") {
    return persistRefund(input.returnStore, {
      ...input.refund,
      status: "requires_attention",
      attentionReason: "open shift is required for cash refund",
    }, input.correlationId);
  }
  if (appended === "negative_expected") {
    return persistRefund(input.returnStore, {
      ...input.refund,
      status: "requires_attention",
      attentionReason: "cash refund would make expected cash negative",
    }, input.correlationId);
  }
  if (appended !== "ok") {
    return apiFailure("INTEGRATION_UNAVAILABLE", "cash refund movement was not accepted", input.correlationId);
  }
  return persistRefund(input.returnStore, {
    ...input.refund,
    status: "verified",
    cashMovementId: movement.id,
    initializeStatus: "initialized",
  }, input.correlationId);
}

async function applyProviderRefund(input: {
  readonly returnStore: ReturnStore;
  readonly checkoutStore: CheckoutStore;
  readonly provider: ElectronicRefundProvider;
  readonly refund: StoredTenderRefund;
  readonly correlationId: string;
}): Promise<ApiResult<RefundState>> {
  const payment = await input.checkoutStore.getPayment(input.refund.paymentId);
  const created = await input.provider.createRefund({
    refundId: input.refund.refundId,
    paymentId: input.refund.paymentId,
    providerTransactionId: payment?.providerTransactionId,
    amount: input.refund.amount,
    currency: input.refund.amount.currency,
  });
  if (created.kind === "lost_response" || created.kind === "timeout" || created.kind === "unavailable") {
    return persistRefund(input.returnStore, {
      ...input.refund,
      status: "pending",
      initializeStatus: created.kind === "lost_response" ? "lost_response" : "pending_remote",
      attentionReason: created.kind === "unavailable" ? created.message : undefined,
    }, input.correlationId);
  }
  if (created.kind === "failed") {
    return persistRefund(input.returnStore, {
      ...input.refund,
      status: "failed",
      attentionReason: created.message,
    }, input.correlationId);
  }
  if (created.kind === "requires_attention") {
    return persistRefund(input.returnStore, {
      ...input.refund,
      status: "requires_attention",
      attentionReason: created.message,
    }, input.correlationId);
  }
  if (created.kind === "pending") {
    return persistRefund(input.returnStore, {
      ...input.refund,
      status: "pending",
      providerRefundReference: created.providerRefundReference,
      initializeStatus: "initialized",
    }, input.correlationId);
  }
  return persistRefund(input.returnStore, {
    ...input.refund,
    status: "verified",
    providerRefundReference: created.providerRefundReference,
    providerTransactionId: created.providerTransactionId ?? payment?.providerTransactionId,
    initializeStatus: "initialized",
  }, input.correlationId);
}

async function reconcileTenderRefund(input: {
  readonly checkoutStore: CheckoutStore;
  readonly returnStore: ReturnStore;
  readonly provider: ElectronicRefundProvider;
  readonly actor: StaffActor;
  readonly refund: StoredTenderRefund;
  readonly now: Date;
  readonly correlationId: string;
}): Promise<ApiResult<RefundState>> {
  if (input.refund.status === "verified") {
    return { ok: true, data: toRefundState(input.refund), correlationId: input.correlationId };
  }
  if (input.refund.channel === "cash_ledger") {
    const existing = await input.checkoutStore.listCashRefunds(input.refund.refundId);
    if (existing.length === 1) {
      return persistRefund(input.returnStore, {
        ...input.refund,
        status: monotonicRefund(input.refund.status, "verified"),
        cashMovementId: existing[0]?.id,
      }, input.correlationId);
    }
    return { ok: true, data: toRefundState(input.refund), correlationId: input.correlationId };
  }
  const payment = await input.checkoutStore.getPayment(input.refund.paymentId);
  const resolved = await input.provider.resolveRefund({
    refundId: input.refund.refundId,
    providerRefundReference: input.refund.providerRefundReference,
  });
  return persistRefund(input.returnStore, applyProviderResolve(input.refund, resolved, payment?.providerTransactionId), input.correlationId);
}

function applyProviderResolve(
  refund: StoredTenderRefund,
  resolved: ProviderRefundResolveResult,
  originalProviderTransactionId?: string,
): StoredTenderRefund {
  if (resolved.kind === "timeout" || resolved.kind === "unavailable" || resolved.kind === "pending") {
    return { ...refund, status: monotonicRefund(refund.status, "pending") };
  }
  if (resolved.kind === "not_found") {
    return {
      ...refund,
      status: monotonicRefund(refund.status, "requires_attention"),
      attentionReason: "provider refund was not found",
    };
  }
  if (resolved.kind === "failed") {
    return { ...refund, status: monotonicRefund(refund.status, "failed"), attentionReason: resolved.message };
  }
  if (resolved.kind === "requires_attention") {
    return {
      ...refund,
      status: monotonicRefund(refund.status, "requires_attention"),
      attentionReason: resolved.message,
    };
  }
  if (resolved.domain === "live") {
    return {
      ...refund,
      status: monotonicRefund(refund.status, "requires_attention"),
      attentionReason: "provider refund domain is live",
    };
  }
  if (resolved.amount.minor !== refund.amount.minor || resolved.currency !== refund.amount.currency) {
    return {
      ...refund,
      status: monotonicRefund(refund.status, "requires_attention"),
      attentionReason: "provider refund amount or currency mismatch",
    };
  }
  if (originalProviderTransactionId && resolved.providerTransactionId && resolved.providerTransactionId !== originalProviderTransactionId) {
    return {
      ...refund,
      status: monotonicRefund(refund.status, "requires_attention"),
      attentionReason: "provider refund is bound to a different original transaction",
    };
  }
  return {
    ...refund,
    status: monotonicRefund(refund.status, "verified"),
    providerRefundReference: resolved.providerRefundReference,
    providerTransactionId: resolved.providerTransactionId ?? refund.providerTransactionId,
  };
}

async function persistRefund(
  store: ReturnStore,
  refund: StoredTenderRefund,
  correlationId: string,
): Promise<ApiResult<RefundState>> {
  await store.saveTenderRefund(refund);
  return { ok: true, data: toRefundState(refund), correlationId };
}

function toRefundState(row: StoredTenderRefund): RefundState {
  return {
    refundId: row.refundId,
    returnId: row.returnId,
    channel: row.channel,
    status: row.status,
    amount: row.amount,
  };
}

function isRefundState(value: unknown): value is RefundState {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const row = value as RefundState;
  return typeof row.refundId === "string" && typeof row.returnId === "string" && typeof row.channel === "string";
}
