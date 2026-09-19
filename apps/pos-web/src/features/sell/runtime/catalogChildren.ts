import type { CatalogItem } from "../../../../../../docs/contracts/domain.generated";
import type { CatalogPort } from "../../../../../../docs/contracts/ports";

const CHILD_PAGE_LIMIT = 50;
const MAX_CHILD_PAGES = 40;

export type CatalogChildrenResult =
  | { readonly ok: true; readonly items: readonly CatalogItem[] }
  | { readonly ok: false };

/**
 * Loads every CatalogPort parentId page. Incomplete retrieval fails closed.
 * Shared by variable-price enrichment and the variation chooser.
 */
export async function loadAllCatalogChildren(catalog: CatalogPort, parentId: string): Promise<CatalogChildrenResult> {
  const items: CatalogItem[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < MAX_CHILD_PAGES; page += 1) {
    const result = await catalog.search({ parentId, cursor, limit: CHILD_PAGE_LIMIT });
    if (!result.ok) {
      return { ok: false };
    }
    for (const item of result.data.items) {
      if (seen.has(item.id)) {
        continue;
      }
      seen.add(item.id);
      items.push(item);
    }
    const nextCursor = result.data.nextCursor;
    if (!nextCursor) {
      return { ok: true, items };
    }
    if (nextCursor === cursor) {
      return { ok: false };
    }
    cursor = nextCursor;
  }
  return { ok: false };
}

export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}
