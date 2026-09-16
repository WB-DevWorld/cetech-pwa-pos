import { toIsoTimestamp } from "../auth/ids";
import { moneyEqual, type CheckoutStore, type PosSaleRecord, type StoredPayment } from "../../core/checkout/types";
import type { ProviderVerifyResult } from "./provider";

const KNOWN_PENDING = new Set(["pending", "ongoing", "processing", "queued"]);

export async function applyProviderVerification(input: {
  readonly store: CheckoutStore;
  readonly sale: PosSaleRecord;
  readonly payment: StoredPayment;
  readonly verification: ProviderVerifyResult;
  readonly now: Date;
}): Promise<StoredPayment> {
  const { store, sale, payment, verification, now } = input;
  const lastVerifiedAt = toIsoTimestamp(now);
  if (verification.kind === "timeout" || verification.kind === "unavailable") {
    return persist(store, sale, {
      ...payment,
      status: "reconciling",
      lastVerifiedAt,
      attentionReason: verification.kind === "timeout" ? "provider verification timed out" : verification.message,
    });
  }
  if (verification.kind === "pending") {
    if (!KNOWN_PENDING.has(verification.providerStatus)) {
      return persist(store, sale, {
        ...payment,
        status: "requires_attention",
        lastVerifiedAt,
        attentionReason: `unrecognized provider status ${verification.providerStatus}`,
      });
    }
    return persist(store, sale, {
      ...payment,
      status: sale.status === "cancelled" || sale.status === "completed" ? "requires_attention" : "pending",
      lastVerifiedAt,
      attentionReason:
        sale.status === "cancelled" || sale.status === "completed"
          ? "pending provider state after sale is no longer payment-eligible"
          : undefined,
    });
  }
  if (verification.kind === "failed" || verification.kind === "cancelled") {
    return persist(store, sale, {
      ...payment,
      status: verification.kind,
      lastVerifiedAt,
    });
  }

  const mismatch = economicMismatch(sale, payment, verification);
  if (mismatch) {
    return persist(store, sale, {
      ...payment,
      status: "requires_attention",
      lastVerifiedAt,
      providerTransactionId: verification.providerTransactionId ?? payment.providerTransactionId,
      attentionReason: mismatch,
    });
  }
  if (sale.status === "cancelled") {
    return persist(store, sale, {
      ...payment,
      status: "requires_attention",
      lastVerifiedAt,
      providerTransactionId: verification.providerTransactionId,
      attentionReason: "provider success arrived after the sale was cancelled",
    });
  }
  if (sale.status === "completed" && sale.assignedPaymentId && sale.assignedPaymentId !== payment.paymentId) {
    return persist(store, sale, {
      ...payment,
      status: "requires_attention",
      lastVerifiedAt,
      providerTransactionId: verification.providerTransactionId,
      attentionReason: "provider success arrived after a different payment completed the sale",
    });
  }

  const verified: StoredPayment = {
    ...payment,
    status: "verified",
    evidenceId: payment.evidenceId ?? crypto.randomUUID(),
    verifiedAt: payment.verifiedAt ?? lastVerifiedAt,
    lastVerifiedAt,
    verificationSource: "provider_server_verification",
    providerTransactionId: verification.providerTransactionId ?? payment.providerTransactionId,
    attentionReason: undefined,
  };
  await store.savePayment(verified);
  if (sale.status !== "completed") {
    await store.saveSale({
      ...sale,
      status: "finalizing",
      assignedPaymentId: verified.paymentId,
    });
  }
  return (await store.getPayment(verified.paymentId)) ?? verified;
}

function economicMismatch(
  sale: PosSaleRecord,
  payment: StoredPayment,
  verification: Extract<ProviderVerifyResult, { kind: "success" }>,
): string | undefined {
  if (verification.domain !== "test") {
    return "provider response is live while test mode is required";
  }
  if (!payment.providerReference || verification.reference !== payment.providerReference) {
    return "provider reference does not match the durable payment intent";
  }
  if (payment.transactionId !== sale.prepared.transactionId || payment.saleId !== sale.prepared.saleId) {
    return "payment is not bound to this sale";
  }
  if (verification.metadata.transactionId && verification.metadata.transactionId !== sale.prepared.transactionId) {
    return "provider metadata transaction does not match the durable sale";
  }
  if (verification.metadata.paymentId && verification.metadata.paymentId !== payment.paymentId) {
    return "provider metadata payment does not match the durable payment";
  }
  if (verification.metadata.saleId && verification.metadata.saleId !== sale.prepared.saleId) {
    return "provider metadata sale does not match the durable sale";
  }
  if (verification.amount.currency !== sale.prepared.total.currency || verification.currency !== sale.prepared.total.currency) {
    return "verified provider currency does not match the prepared sale";
  }
  if (!moneyEqual(verification.amount, sale.prepared.total) || !moneyEqual(payment.amount, sale.prepared.total)) {
    return "verified provider amount does not match the prepared sale";
  }
  return undefined;
}

async function persist(store: CheckoutStore, sale: PosSaleRecord, payment: StoredPayment): Promise<StoredPayment> {
  await store.savePayment(payment);
  const stored = (await store.getPayment(payment.paymentId)) ?? payment;
  if (stored.status === "verified") {
    return stored;
  }
  if (stored.status === "requires_attention" && sale.status !== "completed" && sale.status !== "cancelled") {
    await store.saveSale({ ...sale, status: "requires_attention", assignedPaymentId: stored.paymentId });
  } else if (stored.status === "pending" || stored.status === "reconciling" || stored.status === "awaiting_customer") {
    if (sale.status === "prepared") {
      await store.saveSale({ ...sale, status: "payment_pending", assignedPaymentId: stored.paymentId });
    }
  }
  return stored;
}
