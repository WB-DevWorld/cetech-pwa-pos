import type { Money, PaymentTender, ReceiptLine, SaleStatus } from "../../../../../docs/contracts/domain.generated";
import type { PosSaleRecord, StoredPayment } from "../../core/checkout/types";

export type OrderHistoryStatus =
  | "completed"
  | "refunded"
  | "partially_refunded"
  | "payment_pending"
  | "needs_attention"
  | "cancelled";

export type OrderHistoryPaymentStatus = "verified" | "pending" | "failed" | "requires_attention";

export type OrderHistoryLine = {
  readonly id: string;
  readonly name: string;
  readonly quantity: string;
  readonly total: Money;
  readonly variationLabel?: string;
};

export type OrderHistoryListItem = {
  readonly id: string;
  readonly saleId: string;
  readonly orderReference: string;
  readonly receiptNumber?: string;
  readonly customerLabel: string;
  readonly customerId?: string;
  readonly customerCompany?: string;
  readonly customerKind?: "walkin" | "retail" | "b2b";
  readonly createdAt: string;
  readonly paymentLabel: string;
  readonly paymentStatus?: OrderHistoryPaymentStatus;
  readonly total: Money;
  readonly status: OrderHistoryStatus;
  readonly transactionReference?: string;
  readonly itemSummary?: string;
  readonly cashierLabel?: string;
  readonly registerLabel?: string;
  readonly lines: readonly OrderHistoryLine[];
};

const UNCERTAIN_PAYMENTS: ReadonlySet<StoredPayment["status"]> = new Set([
  "initializing",
  "awaiting_customer",
  "pending",
  "reconciling",
  "requires_attention",
]);

export function isHistorySale(sale: PosSaleRecord): boolean {
  return (
    sale.status === "completed" ||
    sale.status === "cancelled" ||
    sale.status === "requires_attention" ||
    sale.status === "payment_pending" ||
    sale.status === "finalizing"
  );
}

export function tenderLabel(tender: PaymentTender | undefined): string {
  if (tender === "cash") return "Cash";
  if (tender === "mobile_money") return "Mobile Money";
  if (tender === "card") return "Card";
  if (tender === "external_electronic") return "Electronic";
  return "Payment";
}

export function presentPaymentStatus(status: StoredPayment["status"] | undefined): OrderHistoryPaymentStatus | undefined {
  if (!status) return undefined;
  if (status === "verified") return "verified";
  if (status === "failed" || status === "cancelled") return "failed";
  if (status === "requires_attention") return "requires_attention";
  if (UNCERTAIN_PAYMENTS.has(status)) return "pending";
  return undefined;
}

export function presentOrderStatus(status: SaleStatus): OrderHistoryStatus {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "payment_pending") return "payment_pending";
  return "needs_attention";
}

export function itemSummaryFromLines(lines: readonly ReceiptLine[]): string | undefined {
  const first = lines[0];
  if (!first) return undefined;
  const qty = first.quantity;
  const name = first.name;
  if (lines.length === 1) {
    return `${qty} × ${name}`;
  }
  return `${qty} × ${name} · ${lines.length - 1} more`;
}

function customerPresentation(sale: PosSaleRecord): {
  readonly label: string;
  readonly customerId?: string;
  readonly company?: string;
} {
  if (sale.customer.kind === "walkin") {
    return { label: "Walk-in" };
  }

  const customerId = sale.customer.customerId;
  const snapshotLabel = sale.customerSnapshot?.displayName.trim();
  if (snapshotLabel) {
    return {
      label: snapshotLabel,
      customerId,
      ...(sale.customerSnapshot?.company ? { company: sale.customerSnapshot.company } : {}),
    };
  }

  const storedLabel = sale.customerLabel.trim();
  return {
    label: storedLabel && storedLabel !== customerId ? storedLabel : "Saved customer account",
    customerId,
  };
}

export function presentOrderHistoryItem(
  sale: PosSaleRecord,
  payment: StoredPayment | undefined,
): OrderHistoryListItem {
  const receipt = sale.receipt;
  const customer = customerPresentation(sale);
  const lines: readonly OrderHistoryLine[] = (sale.lines.length > 0 ? sale.lines : []).map((line, index) => ({
    id: sale.orderLines?.[index]?.orderLineId ?? `line-${index}`,
    name: line.name,
    quantity: line.quantity,
    total: line.total,
    variationLabel: line.variationLabel,
  }));
  return {
    id: sale.prepared.transactionId,
    saleId: sale.prepared.saleId,
    orderReference: sale.prepared.orderReference || sale.prepared.saleId,
    receiptNumber: receipt?.receiptNumber,
    customerLabel: customer.label,
    customerId: customer.customerId,
    customerCompany: customer.company,
    customerKind: sale.customer.kind,
    createdAt: receipt?.issuedAt ?? sale.prepared.preparedAt,
    paymentLabel: tenderLabel(payment?.tender ?? receipt?.tender),
    paymentStatus: presentPaymentStatus(payment?.status) ?? (receipt ? "verified" : undefined),
    total: receipt?.total ?? sale.prepared.total,
    status: presentOrderStatus(sale.status),
    transactionReference: sale.prepared.transactionId,
    itemSummary: itemSummaryFromLines(sale.lines),
    cashierLabel: sale.cashierName,
    registerLabel: sale.registerName,
    lines,
  };
}

export function matchesOrderQuery(item: OrderHistoryListItem, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [
    item.orderReference,
    item.receiptNumber,
    item.customerLabel,
    item.customerId,
    item.customerCompany,
    item.transactionReference,
    item.saleId,
    item.itemSummary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase()
    .includes(needle);
}
