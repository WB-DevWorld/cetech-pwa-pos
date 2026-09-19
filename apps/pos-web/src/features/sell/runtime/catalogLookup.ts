import type { CatalogPort } from "../../../../../../docs/contracts/ports";
import { catalogItemToSellView } from "./mapCatalog";
import { loadAllCatalogChildren, mapPool } from "./catalogChildren";
import { deriveVariableDisplayPrice, type ProductDisplayPriceView } from "../state/variableDisplayPrice";
import type { SellProductView } from "../state/sellView";

export async function searchCatalogViews(
  catalog: CatalogPort,
  query: string,
): Promise<{ ok: true; items: readonly SellProductView[] } | { ok: false }> {
  const result = await catalog.search({ query, limit: 50 });
  if (!result.ok) {
    return { ok: false };
  }
  return { ok: true, items: result.data.items.map(catalogItemToSellView) };
}

export async function lookupBarcodeViews(
  catalog: CatalogPort,
  barcode: string,
): Promise<{ ok: true; items: readonly SellProductView[] } | { ok: false }> {
  const result = await catalog.search({ barcode });
  if (!result.ok) {
    return { ok: false };
  }
  const items = result.data.items.map(catalogItemToSellView);
  const extra: SellProductView[] = [];
  for (const item of items) {
    if (item.kind === "variable") {
      const children = await loadAllCatalogChildren(catalog, item.id);
      if (!children.ok) {
        return { ok: false };
      }
      extra.push(...children.items.map(catalogItemToSellView));
    }
  }
  return { ok: true, items: [...items, ...extra] };
}

export async function lookupProductView(
  catalog: CatalogPort,
  productId: string,
): Promise<SellProductView | null> {
  const result = await catalog.search({ productId });
  if (!result.ok || result.data.items.length === 0) {
    return null;
  }
  const item = result.data.items[0];
  return item ? catalogItemToSellView(item) : null;
}

export async function lookupVariations(
  catalog: CatalogPort,
  parentId: string,
): Promise<{ ok: true; items: readonly SellProductView[] } | { ok: false }> {
  const result = await loadAllCatalogChildren(catalog, parentId);
  if (!result.ok) {
    return { ok: false };
  }
  return { ok: true, items: result.items.map(catalogItemToSellView) };
}

export async function enrichSellProductPrices(
  catalog: CatalogPort,
  items: readonly SellProductView[],
  cache: Map<string, ProductDisplayPriceView>,
): Promise<SellProductView[]> {
  for (const item of items) {
    if (item.kind !== "variable" || cache.has(item.id)) {
      continue;
    }
    if (item.displayPrice && Number.isInteger(item.displayPrice.minor) && item.displayPrice.minor >= 0 && item.displayPrice.currency) {
      cache.set(item.id, { kind: "single", amount: item.displayPrice });
    }
  }
  const parents = items.filter((item) => item.kind === "variable" && !cache.has(item.id));
  await mapPool(parents, 4, async (parent) => {
    const children = await loadAllCatalogChildren(catalog, parent.id);
    cache.set(parent.id, deriveVariableDisplayPrice(parent, children));
  });
  return items.map((item) => {
    if (item.kind !== "variable") {
      return item;
    }
    return { ...item, priceView: cache.get(item.id) ?? { kind: "unavailable" } };
  });
}
