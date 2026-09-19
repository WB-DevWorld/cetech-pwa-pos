import type { PosSaleRecord } from "../../core/checkout/types";

export type HistoricReturnSaleLineProjection = {
  readonly orderLineId: string;
  readonly name: string;
  readonly originalSoldQuantity: string;
};

export type HistoricReturnSaleProjection = {
  readonly saleId: string;
  readonly orderReference: string;
  readonly currency: string;
  readonly lines: readonly HistoricReturnSaleLineProjection[];
  readonly customerLabel?: string;
  readonly createdAt?: string;
  readonly total?: { readonly minor: number; readonly currency: string };
  readonly itemSummary?: string;
};

/**
 * Read-only BFF projection for FE-06 historic sale lookup.
 * Identity comes only from durable `orderLines[].orderLineId`.
 * Receipt/display lines may supply a name, never an identity.
 */
export function projectHistoricReturnSale(sale: PosSaleRecord): HistoricReturnSaleProjection | undefined {
  if (sale.status !== "completed") {
    return undefined;
  }
  const orderLines = sale.orderLines;
  if (!orderLines || orderLines.length === 0) {
    return undefined;
  }
  const namesAligned = sale.lines.length === orderLines.length;
  const lines = orderLines.map((line, index) => ({
    orderLineId: line.orderLineId,
    name:
      namesAligned && sale.lines[index]?.name
        ? sale.lines[index].name
        : `Sale line ${line.orderLineId}`,
    originalSoldQuantity: line.quantity,
  }));
  const first = lines[0];
  return {
    saleId: sale.prepared.saleId,
    orderReference: sale.prepared.orderReference || sale.prepared.saleId,
    currency: sale.prepared.total.currency,
    lines,
    customerLabel: sale.customerLabel,
    createdAt: sale.receipt?.issuedAt ?? sale.prepared.preparedAt,
    total: sale.receipt?.total ?? sale.prepared.total,
    itemSummary: first
      ? lines.length === 1
        ? `${first.originalSoldQuantity} × ${first.name}`
        : `${first.originalSoldQuantity} × ${first.name} · ${lines.length - 1} more`
      : undefined,
  };
}
