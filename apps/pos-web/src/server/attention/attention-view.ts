import type { PendingOperation } from "../../../../../docs/contracts/domain.generated";
import type { AttentionItemView } from "../../ui/operational";
import type { CommandScopeBinding, PosSaleRecord, StoredPayment, StoredShift } from "../../core/checkout/types";

const UNCERTAIN: ReadonlySet<StoredPayment["status"]> = new Set([
  "initializing",
  "awaiting_customer",
  "pending",
  "reconciling",
  "requires_attention",
]);

const SALE_OPERATIONS: ReadonlySet<PendingOperation["operation"]> = new Set([
  "sale.prepare",
  "sale.finalize",
  "sale.cancel",
]);

const PAYMENT_OPERATIONS: ReadonlySet<PendingOperation["operation"]> = new Set([
  "payment.initialize",
  "payment.cash",
  "payment.resolve",
]);

const RETURN_OPERATIONS: ReadonlySet<PendingOperation["operation"]> = new Set([
  "return.execute",
  "return.resolve",
  "payment.refund",
  "refund.resolve",
  "bridge.commercial_refund",
  "bridge.stock_disposition",
]);

export function classifyOperationRecovery(operation: PendingOperation["operation"]): {
  readonly recoverKind: AttentionItemView["recoverKind"];
  readonly resolveAllowed: boolean;
} {
  if (SALE_OPERATIONS.has(operation)) {
    return { recoverKind: "sale", resolveAllowed: true };
  }
  if (PAYMENT_OPERATIONS.has(operation)) {
    return { recoverKind: "payment", resolveAllowed: true };
  }
  if (RETURN_OPERATIONS.has(operation)) {
    return { recoverKind: "return", resolveAllowed: false };
  }
  if (operation === "shift.open" || operation === "shift.close" || operation === "cash.movement") {
    return { recoverKind: "shift", resolveAllowed: false };
  }
  return { recoverKind: undefined, resolveAllowed: false };
}

export function attentionFromPayment(payment: StoredPayment): AttentionItemView {
  const reference = payment.displayReference ?? payment.transactionId;
  const critical = payment.status === "requires_attention";
  return {
    id: `payment:${payment.paymentId}`,
    title: critical ? "Payment needs review" : "Payment awaiting verification",
    summary:
      "This payment is still being checked. Do not charge the customer again until it is resolved.",
    typeLabel: "Payment",
    severity: critical ? "critical" : "medium",
    transactionReference: reference,
    transactionId: payment.transactionId,
    paymentId: payment.paymentId,
    resolveAllowed: true,
    reviewAllowed: false,
    recoverKind: "payment",
  };
}

export function attentionFromSale(sale: PosSaleRecord): AttentionItemView {
  return {
    id: `sale:${sale.prepared.transactionId}`,
    title: "Sale needs review",
    summary: "This sale did not finish cleanly. Resolve the existing transaction. Do not start a replacement sale for the same payment.",
    typeLabel: "Sale",
    severity: "critical",
    transactionReference: sale.prepared.orderReference || sale.prepared.transactionId,
    transactionId: sale.prepared.transactionId,
    resolveAllowed: true,
    reviewAllowed: false,
    recoverKind: "sale",
  };
}

export function attentionFromShift(shift: StoredShift): AttentionItemView {
  return {
    id: `shift:${shift.id}`,
    title: "Shift needs manager review",
    summary: "Counted cash was recorded. Variance still requires attention. Do not open a replacement close to bypass this state.",
    typeLabel: "Shift",
    severity: "medium",
    transactionReference: shift.id,
    resolveAllowed: false,
    reviewAllowed: false,
    recoverKind: "shift",
  };
}

export function attentionFromOperation(scope: CommandScopeBinding): AttentionItemView {
  const classified = classifyOperationRecovery(scope.operation);
  const resolveAllowed = classified.resolveAllowed && Boolean(scope.transactionId);
  const summary = resolveAllowed
    ? "A POS command did not finish cleanly. Recover the existing operation. Do not create a second payment, sale, or refund."
    : "This operation needs manager or reconciliation review. Do not create a second payment, sale, refund, or stock movement.";
  return {
    id: `operation:${scope.operation}:${scope.transactionId}`,
    title: "Operation needs recovery",
    summary,
    typeLabel: "Operation",
    severity: "critical",
    transactionReference: scope.transactionId,
    transactionId: scope.transactionId,
    resolveAllowed,
    reviewAllowed: false,
    recoverKind: classified.recoverKind,
  };
}

export function composeAttentionItems(input: {
  readonly payments: readonly StoredPayment[];
  readonly sales: readonly PosSaleRecord[];
  readonly shifts: readonly StoredShift[];
  readonly operations: readonly CommandScopeBinding[];
}): readonly AttentionItemView[] {
  const items: AttentionItemView[] = [];
  const seen = new Set<string>();
  const coveredTransactions = new Set<string>();
  for (const payment of input.payments) {
    if (!UNCERTAIN.has(payment.status)) continue;
    const item = attentionFromPayment(payment);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    coveredTransactions.add(payment.transactionId);
    items.push(item);
  }
  for (const sale of input.sales) {
    if (sale.status !== "requires_attention" && sale.status !== "payment_pending" && sale.status !== "finalizing") {
      continue;
    }
    if (coveredTransactions.has(sale.prepared.transactionId)) continue;
    const item = attentionFromSale(sale);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    coveredTransactions.add(sale.prepared.transactionId);
    items.push(item);
  }
  for (const shift of input.shifts) {
    const item = attentionFromShift(shift);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  for (const operation of input.operations) {
    if (coveredTransactions.has(operation.transactionId)) continue;
    const item = attentionFromOperation(operation);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
