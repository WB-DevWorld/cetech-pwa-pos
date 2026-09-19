import type { CatalogItem } from "../../../../../../docs/contracts/domain.generated";
import type { SellProductView, StockPresentation } from "../state/sellView";

export function catalogItemToSellView(item: CatalogItem): SellProductView {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    barcodes: [...item.barcodes],
    kind: item.kind,
    parentId: item.parentId,
    variationLabel: item.variationLabel,
    stockStatus: item.stockStatus as StockPresentation,
    displayPrice: item.displayPrice
      ? { minor: item.displayPrice.minor, currency: item.displayPrice.currency }
      : undefined,
    priceView: item.displayPrice
      ? { kind: "single", amount: { minor: item.displayPrice.minor, currency: item.displayPrice.currency } }
      : item.kind === "variable"
        ? { kind: "unavailable" }
        : undefined,
  };
}

export function browseCatalogViews(items: readonly CatalogItem[]): SellProductView[] {
  return items.filter((item) => item.kind !== "variation").map(catalogItemToSellView);
}
