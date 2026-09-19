export type RefundChannelView = "cash_ledger" | "provider_electronic";

export type RefundStatusView = "idle" | "pending" | "verified" | "failed" | "requires_attention" | "unknown";

export type RefundMoneyView = {
  readonly minor: number;
  readonly currency: string;
};

export type RefundReconciliationView = {
  readonly refundId: string;
  readonly returnId?: string;
  readonly channel?: RefundChannelView;
  readonly status: RefundStatusView;
  readonly amount?: RefundMoneyView;
  readonly message: string;
  readonly warning?: string;
  readonly resolveAllowed: boolean;
};

export function idleRefundReconciliation(refundId: string): RefundReconciliationView {
  return {
    refundId,
    status: "idle",
    message: "This refund is unresolved. Check its status. Do not start another refund.",
    warning: "Do not issue another refund.",
    resolveAllowed: true,
  };
}

export function describeRefundStatus(status: RefundStatusView): string {
  if (status === "pending") return "Refund pending";
  if (status === "verified") return "Refund verified";
  if (status === "failed") return "Refund failed";
  if (status === "requires_attention") return "Refund needs manager review";
  if (status === "unknown") return "Refund status unknown";
  return "Refund";
}
