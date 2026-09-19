import type { SellProductView, StockPresentation } from "./sellView";

export type ProductBadgeTone = "info" | "warning" | "danger";

export type ProductBadgeView = {
  readonly id: string;
  readonly label: string;
  readonly tone: ProductBadgeTone;
};

export type StockCopyView = {
  readonly text: string;
  readonly tone: "neutral" | "low" | "out" | "backorder";
};

/** Structured badges only. Never infer wholesale/sale/quantity/B2B labels from names or SKUs. */
export function productBadges(item: Pick<SellProductView, "kind" | "stockStatus">): ProductBadgeView[] {
  const badges: ProductBadgeView[] = [];
  if (item.kind === "variable") {
    badges.push({ id: "variable", label: "Variable product", tone: "info" });
  }
  if (item.stockStatus === "low_stock") {
    badges.push({ id: "low_stock", label: "Low stock", tone: "warning" });
  }
  if (item.stockStatus === "out_of_stock") {
    badges.push({ id: "out_of_stock", label: "Out of stock", tone: "danger" });
  }
  if (item.stockStatus === "backorder") {
    badges.push({ id: "backorder", label: "Backorder", tone: "warning" });
  }
  return badges;
}

export function productStockCopy(item: Pick<SellProductView, "stockStatus">): StockCopyView {
  switch (item.stockStatus) {
    case "out_of_stock":
      return { text: "Out of stock", tone: "out" };
    case "low_stock":
      return { text: "Low stock", tone: "low" };
    case "backorder":
      return { text: "Backorder", tone: "backorder" };
    case "in_stock":
      return { text: "In stock", tone: "neutral" };
    default:
      return { text: "Stock unknown", tone: "neutral" };
  }
}

export function stockStatusClass(status: StockPresentation): string {
  if (status === "out_of_stock") return "stock-line out";
  if (status === "low_stock") return "stock-line low";
  if (status === "backorder") return "stock-line backorder";
  return "stock-line";
}
