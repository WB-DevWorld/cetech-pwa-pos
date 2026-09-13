import type { CatalogPort } from "../../../../../../docs/contracts/ports";
import { catalogItemToSellView } from "./mapCatalog";
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
      const children = await catalog.search({ parentId: item.id, limit: 50 });
      if (!children.ok) {
        return { ok: false };
      }
      extra.push(...children.data.items.map(catalogItemToSellView));
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
  const result = await catalog.search({ parentId, limit: 50 });
  if (!result.ok) {
    return { ok: false };
  }
  return { ok: true, items: result.data.items.map(catalogItemToSellView) };
}
