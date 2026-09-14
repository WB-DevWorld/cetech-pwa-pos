import type { CatalogItem, CatalogPage, Id } from "../../../../../docs/contracts/domain.generated";
import { normalizeSearchText, preserveBarcode, searchHaystackIncludes } from "./normalize";
import type { BarcodeLookup, ProjectedCatalogItem } from "./source";

export type CatalogSearchInput = {
  readonly query?: string;
  readonly barcode?: string;
  readonly productId?: Id;
  readonly parentId?: Id;
  readonly cursor?: string;
  readonly limit?: number;
};

export const CATALOG_SEARCH_GRAM_SIZE = 3;
export const CATALOG_SEARCH_DEFAULT_LIMIT = 50;
export const CATALOG_SEARCH_MAX_LIMIT = 200;

export function compareCatalogId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function resolveCatalogSearchLimit(limit: number | undefined): number {
  return limit && limit > 0 ? Math.min(limit, CATALOG_SEARCH_MAX_LIMIT) : CATALOG_SEARCH_DEFAULT_LIMIT;
}

export function projectedToCatalogItem(item: ProjectedCatalogItem): CatalogItem {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    barcodes: [...item.barcodes],
    kind: item.kind,
    parentId: item.parentId,
    variationLabel: item.variationLabel,
    displayPrice: item.displayPrice ? { ...item.displayPrice } : undefined,
    stockStatus: item.stockStatus,
    projectionUpdatedAt: item.projectionUpdatedAt,
  };
}

export function catalogPageFromBarcodeLookup(lookup: BarcodeLookup): CatalogPage {
  if (lookup.status === "missing") {
    return { items: [] };
  }
  if (lookup.status === "unique") {
    return { items: [lookup.item] };
  }
  return { items: [...lookup.items] };
}

export function catalogItemMatchesTypedQuery(item: ProjectedCatalogItem, query: string): boolean {
  if (item.tombstoned || item.kind === "variation") {
    return false;
  }
  if (!query.trim()) {
    return true;
  }
  return (
    searchHaystackIncludes(item.searchNormalized, query) ||
    item.barcodes.some((code) => code.includes(preserveBarcode(query.trim())))
  );
}

export function paginateProjectedItems(
  items: ReadonlyArray<ProjectedCatalogItem>,
  cursor: string | undefined,
  limit: number,
): CatalogPage {
  const ordered = [...items].sort((a, b) => compareCatalogId(a.id, b.id));
  const afterCursor = cursor ? ordered.filter((item) => item.id > cursor) : ordered;
  const pageItems = afterCursor.slice(0, limit);
  const lastReturned = pageItems[pageItems.length - 1];
  return afterCursor.length > limit && lastReturned
    ? {
        items: pageItems.map(projectedToCatalogItem),
        nextCursor: lastReturned.id,
      }
    : {
        items: pageItems.map(projectedToCatalogItem),
      };
}

/**
 * Persistent Dexie multi-entry grams for bounded substring lookup.
 * Final match still uses haystack/barcode predicates; grams only candidate-filter.
 */
export function catalogSearchGrams(
  searchNormalized: string,
  barcodes: ReadonlyArray<string>,
): string[] {
  const grams = new Set<string>();
  addAllGramSizes(grams, searchNormalized);
  for (const barcode of barcodes) {
    addAllGramSizes(grams, preserveBarcode(barcode));
  }
  return [...grams];
}

export function pickIndexedSearchGram(query: string): string | undefined {
  const trimmed = query.trim();
  if (!trimmed) {
    return undefined;
  }
  const normalized = normalizeSearchText(trimmed);
  const token = pickSelectiveToken(normalized);
  const source = token.length > 0 ? token : preserveBarcode(trimmed);
  if (source.length === 0) {
    return undefined;
  }
  return source.slice(0, Math.min(CATALOG_SEARCH_GRAM_SIZE, source.length));
}

function pickSelectiveToken(normalized: string): string {
  const tokens = normalized.split(" ").filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return "";
  }
  const withDigits = tokens.filter((token) => /\d/.test(token));
  const pool = withDigits.length > 0 ? withDigits : tokens;
  return pool.reduce((best, token) => (token.length >= best.length ? token : best));
}

function addAllGramSizes(target: Set<string>, text: string): void {
  if (text.length === 0) {
    return;
  }
  const max = Math.min(CATALOG_SEARCH_GRAM_SIZE, text.length);
  for (let size = 1; size <= max; size += 1) {
    for (let index = 0; index <= text.length - size; index += 1) {
      target.add(text.slice(index, index + size));
    }
  }
}
