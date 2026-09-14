import type { CatalogPage, Id } from "../../../../docs/contracts/domain.generated";
import { preserveBarcode } from "../core/catalog/normalize";
import {
  catalogItemMatchesTypedQuery,
  catalogPageFromBarcodeLookup,
  compareCatalogId,
  paginateProjectedItems,
  pickIndexedSearchGram,
  projectedToCatalogItem,
  resolveCatalogSearchLimit,
  type CatalogSearchInput,
} from "../core/catalog/query";
import type { BarcodeLookup } from "../core/catalog/source";
import { openPosLocalDatabase, type CatalogItemRow, type PosLocalDatabase } from "./pos-local-db";

export type LocalCatalogIndexedPath =
  | "barcode"
  | "productId"
  | "parentId"
  | "searchGrams"
  | "idCursor";

export type LocalCatalogQueryStats = {
  readonly engineReconstructed: false;
  readonly catalogItemRowsLoaded: number;
  readonly barcodeIndexRowsLoaded: number;
  readonly indexedKeysRead: number;
  readonly usedIndexedPath: LocalCatalogIndexedPath;
};

export type LocalCatalogQueryResult = {
  readonly page: CatalogPage;
  readonly stats: LocalCatalogQueryStats;
};

const ID_FETCH_CHUNK = 64;

/**
 * Bounded local CatalogPort search. Does not load the full IndexedDB catalog or
 * reconstruct CatalogProjectionEngine. Grams/barcode/parent/id indexes candidate-filter;
 * R4 match and cursor semantics still apply to loaded rows.
 */
export async function searchLocalCatalog(
  input: CatalogSearchInput,
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<LocalCatalogQueryResult> {
  const meter = {
    catalogItemRowsLoaded: 0,
    barcodeIndexRowsLoaded: 0,
    indexedKeysRead: 0,
  };
  const limit = resolveCatalogSearchLimit(input.limit);

  if (input.barcode !== undefined && input.barcode.length > 0) {
    const lookup = await lookupBarcodeIndexed(db, input.barcode, meter);
    return finish("barcode", catalogPageFromBarcodeLookup(lookup), meter);
  }

  if (input.productId) {
    meter.catalogItemRowsLoaded += 1;
    const row = await db.catalogItems.get(input.productId);
    const page: CatalogPage =
      row && !row.tombstoned ? { items: [projectedToCatalogItem(row)] } : { items: [] };
    return finish("productId", page, meter);
  }

  if (input.parentId) {
    const rows = await db.catalogItems.where("parentId").equals(input.parentId).toArray();
    meter.catalogItemRowsLoaded += rows.length;
    const live = rows.filter((row) => !row.tombstoned);
    return finish("parentId", paginateProjectedItems(live, input.cursor, limit), meter);
  }

  const query = input.query ?? "";
  const gram = pickIndexedSearchGram(query);
  if (gram) {
    const keys = await db.catalogItems.where("searchGrams").equals(gram).primaryKeys();
    meter.indexedKeysRead += keys.length;
    const ids = [...new Set(keys.map((key) => String(key)))]
      .filter((id) => (input.cursor ? id > input.cursor : true))
      .sort(compareCatalogId);
    const matches = await collectMatchingRows(db, ids, (row) => catalogItemMatchesTypedQuery(row, query), limit + 1, meter);
    return finish("searchGrams", pageFromPrefetched(matches, limit), meter);
  }

  const matches = await collectLiveNonVariationsById(db, input.cursor, limit + 1, meter);
  return finish("idCursor", pageFromPrefetched(matches, limit), meter);
}

function finish(
  usedIndexedPath: LocalCatalogIndexedPath,
  page: CatalogPage,
  meter: {
    catalogItemRowsLoaded: number;
    barcodeIndexRowsLoaded: number;
    indexedKeysRead: number;
  },
): LocalCatalogQueryResult {
  return {
    page,
    stats: {
      engineReconstructed: false,
      catalogItemRowsLoaded: meter.catalogItemRowsLoaded,
      barcodeIndexRowsLoaded: meter.barcodeIndexRowsLoaded,
      indexedKeysRead: meter.indexedKeysRead,
      usedIndexedPath,
    },
  };
}

function pageFromPrefetched(matches: ReadonlyArray<CatalogItemRow>, limit: number): CatalogPage {
  const pageItems = matches.slice(0, limit);
  const lastReturned = pageItems[pageItems.length - 1];
  return matches.length > limit && lastReturned
    ? {
        items: pageItems.map(projectedToCatalogItem),
        nextCursor: lastReturned.id,
      }
    : {
        items: pageItems.map(projectedToCatalogItem),
      };
}

async function lookupBarcodeIndexed(
  db: PosLocalDatabase,
  rawBarcode: string,
  meter: { catalogItemRowsLoaded: number; barcodeIndexRowsLoaded: number },
): Promise<BarcodeLookup> {
  const barcode = preserveBarcode(rawBarcode);
  const indexRow = await db.barcodeIndex.get(barcode);
  meter.barcodeIndexRowsLoaded += 1;
  if (!indexRow || indexRow.itemIds.length === 0) {
    return { status: "missing", barcode };
  }
  const ids = [...indexRow.itemIds].sort(compareCatalogId);
  const rows = await db.catalogItems.bulkGet(ids);
  meter.catalogItemRowsLoaded += ids.length;
  const items = rows
    .filter((row): row is CatalogItemRow => row !== undefined && !row.tombstoned)
    .sort((a, b) => compareCatalogId(a.id, b.id))
    .map(projectedToCatalogItem);
  if (items.length === 0) {
    return { status: "missing", barcode };
  }
  if (items.length === 1) {
    return { status: "unique", barcode, item: items[0]! };
  }
  return { status: "duplicate", barcode, items };
}

async function collectMatchingRows(
  db: PosLocalDatabase,
  ids: ReadonlyArray<Id>,
  accept: (row: CatalogItemRow) => boolean,
  needed: number,
  meter: { catalogItemRowsLoaded: number },
): Promise<CatalogItemRow[]> {
  const matches: CatalogItemRow[] = [];
  for (let offset = 0; offset < ids.length && matches.length < needed; offset += ID_FETCH_CHUNK) {
    const chunk = ids.slice(offset, offset + ID_FETCH_CHUNK);
    const rows = await db.catalogItems.bulkGet(chunk);
    meter.catalogItemRowsLoaded += chunk.length;
    for (const row of rows) {
      if (!row || !accept(row)) {
        continue;
      }
      matches.push(row);
      if (matches.length >= needed) {
        break;
      }
    }
  }
  return matches;
}

async function collectLiveNonVariationsById(
  db: PosLocalDatabase,
  cursor: string | undefined,
  needed: number,
  meter: { catalogItemRowsLoaded: number },
): Promise<CatalogItemRow[]> {
  const matches: CatalogItemRow[] = [];
  const collection = cursor ? db.catalogItems.where("id").above(cursor) : db.catalogItems.orderBy("id");
  await collection.until(() => matches.length >= needed).each((row) => {
    meter.catalogItemRowsLoaded += 1;
    if (row.tombstoned || row.kind === "variation") {
      return;
    }
    matches.push(row);
  });
  return matches;
}
