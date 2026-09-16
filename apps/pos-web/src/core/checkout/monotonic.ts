import type { SaleStatus } from "../../../../../docs/contracts/domain.generated";
import type { PosSaleRecord, StoredPayment } from "./types";

/**
 * Durable checkout ranks. finalizing/completed are floors: a stale concurrent
 * writer cannot move them backward. cancelled is an independent terminal.
 */
export function saleStatusRank(status: SaleStatus): number {
  switch (status) {
    case "not_found":
      return 0;
    case "preparing":
      return 1;
    case "prepared":
      return 2;
    case "payment_pending":
    case "requires_attention":
      return 3;
    case "finalizing":
      return 4;
    case "completed":
    case "cancelled":
      return 5;
    default:
      return 0;
  }
}

export function mergeStoredPayment(existing: StoredPayment | undefined, incoming: StoredPayment): StoredPayment {
  if (existing?.status !== "verified") {
    return incoming;
  }
  if (incoming.status === "verified") {
    return {
      ...incoming,
      evidenceId: existing.evidenceId ?? incoming.evidenceId,
      verifiedAt: existing.verifiedAt ?? incoming.verifiedAt,
      verificationSource: existing.verificationSource ?? incoming.verificationSource,
      providerTransactionId: existing.providerTransactionId ?? incoming.providerTransactionId,
    };
  }
  return {
    ...incoming,
    status: "verified",
    evidenceId: existing.evidenceId,
    verifiedAt: existing.verifiedAt,
    verificationSource: existing.verificationSource,
    providerTransactionId: existing.providerTransactionId ?? incoming.providerTransactionId,
    attentionReason: existing.attentionReason,
    lastVerifiedAt: incoming.lastVerifiedAt ?? existing.lastVerifiedAt,
  };
}

export function mergeStoredSale(existing: PosSaleRecord | undefined, incoming: PosSaleRecord): PosSaleRecord {
  if (!existing) {
    return { ...incoming };
  }
  const keepStatus =
    saleStatusRank(existing.status) >= 4 && saleStatusRank(incoming.status) < saleStatusRank(existing.status);
  return {
    ...incoming,
    status: keepStatus ? existing.status : incoming.status,
    assignedPaymentId: existing.assignedPaymentId ?? incoming.assignedPaymentId,
    commercialConfirmed: existing.commercialConfirmed || incoming.commercialConfirmed,
    receipt: existing.receipt ?? incoming.receipt,
  };
}
