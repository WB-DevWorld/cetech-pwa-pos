import type { AttentionItemView } from "../../ui/operational";
import type { CommandScopeBinding, PosSaleRecord, StoredPayment, StoredShift } from "../../core/checkout/types";

const UNCERTAIN: ReadonlySet<StoredPayment["status"]> = new Set([
  "initializing",
  "awaiting_customer",
  "pending",
  "reconciling",
  "requires_attention",
]);

export function attentionFromPayment(payment: StoredPayment): AttentionItemView {
  const reference = payment.displayReference ?? payment.transactionId;
  const critical = payment.status === "requires_attention";
  return {
    id: `payment:${payment.paymentId}`,
    title: critical ? "Payment needs review" : "Payment awaiting verification",
    summary:
      "This payment is still being checked. Do not charge the customer again until it is resolved.",
    typeLabel: "payment",
    severity: critical ? "critical" : "medium",
    transactionReference: reference,
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
    typeLabel: "sale",
    severity: "critical",
    transactionReference: sale.prepared.orderReference || sale.prepared.transactionId,
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
    typeLabel: "shift",
    severity: "medium",
    transactionReference: shift.id,
    resolveAllowed: false,
    reviewAllowed: false,
    recoverKind: "shift",
  };
}

export function attentionFromOperation(scope: CommandScopeBinding): AttentionItemView {
  return {
    id: `operation:${scope.operation}:${scope.transactionId}`,
    title: "Operation needs recovery",
    summary: "A POS command did not finish cleanly. Recover the existing operation. Do not create a second payment, sale, or refund.",
    typeLabel: "operation",
    severity: "critical",
    transactionReference: scope.transactionId,
    resolveAllowed: true,
    reviewAllowed: false,
    recoverKind: "sale",
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
  for (const payment of input.payments) {
    if (!UNCERTAIN.has(payment.status)) continue;
    const item = attentionFromPayment(payment);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  for (const sale of input.sales) {
    if (sale.status !== "requires_attention" && sale.status !== "payment_pending" && sale.status !== "finalizing") {
      continue;
    }
    const covered = input.payments.some((payment) => payment.transactionId === sale.prepared.transactionId);
    if (covered) continue;
    const item = attentionFromSale(sale);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  for (const shift of input.shifts) {
    const item = attentionFromShift(shift);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  for (const operation of input.operations) {
    const covered = items.some((item) => item.transactionReference === operation.transactionId);
    if (covered) continue;
    const item = attentionFromOperation(operation);
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
