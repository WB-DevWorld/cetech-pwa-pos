import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CatalogProjectionEngine } from "../../../apps/pos-web/src/core/catalog/engine";
import {
  applyCatalogIncremental,
  createLocalCatalogPort,
  loadCatalogEngine,
  persistCatalogEngine,
  searchLocalCatalog,
} from "../../../apps/pos-web/src/local/catalog-repository";
import { createCartDraftStore } from "../../../apps/pos-web/src/local/cart-draft-store";
import {
  POS_LOCAL_SCHEMA_V1,
  POS_LOCAL_SCHEMA_V2,
  POS_LOCAL_SCHEMA_V3,
  closePosLocalDatabase,
  deletePosLocalDatabase,
  openPosLocalDatabase,
} from "../../../apps/pos-web/src/local/pos-local-db";
import {
  DUPLICATE_BARCODE,
  DUPLICATE_ITEM_A_ID,
  DUPLICATE_ITEM_B_ID,
  EXACT_VARIATION_BARCODE,
  EXACT_VARIATION_ID,
  LEADING_ZERO_BARCODE,
  LEADING_ZERO_ITEM_ID,
  SYNTHETIC_CATALOG_COUNT,
  TOMBSTONE_ITEM_ID,
  VARIABLE_PARENT_ID,
  createSyntheticCatalogRecords,
  createTombstoneUpdate,
} from "./fixtures/synthetic-catalog";

const DBS: string[] = [];

function uniqueDb() {
  const name = `cetech-pos-local-${crypto.randomUUID()}`;
  DBS.push(name);
  return openPosLocalDatabase(name);
}

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

async function r4HotPathSearch(
  db: ReturnType<typeof openPosLocalDatabase>,
  input: Parameters<typeof searchLocalCatalog>[0],
) {
  const engine = await loadCatalogEngine(db);
  return engine.search(input);
}

describe("HARDEN-01 local catalog query/index path", () => {
  test(
    "real Dexie adapter on 5,000 items uses indexes instead of reloading every row",
    async () => {
    const db = uniqueDb();
    const records = createSyntheticCatalogRecords();
    expect(records.length).toBeGreaterThanOrEqual(SYNTHETIC_CATALOG_COUNT);
    const engine = new CatalogProjectionEngine();
    engine.rebuild(records, "fixture-v1", "2026-09-13T20:00:00.000Z");
    await persistCatalogEngine(engine, db);

    const queries = {
      nameSearch: { query: "bulk item 1234" },
      exactBarcode: { barcode: LEADING_ZERO_BARCODE },
      duplicateBarcode: { barcode: DUPLICATE_BARCODE },
      parentLookup: { parentId: VARIABLE_PARENT_ID },
    } as const;

    const before: Record<string, { ms: number; ids: string[] }> = {};
    for (const [label, input] of Object.entries(queries)) {
      const started = performance.now();
      const page = await r4HotPathSearch(db, input);
      before[label] = {
        ms: Number((performance.now() - started).toFixed(2)),
        ids: page.items.map((item) => item.id),
      };
    }

    const toArraySpy = vi.spyOn(db.catalogItems, "toArray");
    const replaceSpy = vi.spyOn(CatalogProjectionEngine.prototype, "replaceSnapshot");

    const after: Record<
      string,
      {
        ms: number;
        ids: string[];
        catalogItemRowsLoaded: number;
        barcodeIndexRowsLoaded: number;
        indexedKeysRead: number;
        usedIndexedPath: string;
        engineReconstructed: boolean;
      }
    > = {};
    for (const [label, input] of Object.entries(queries)) {
      const started = performance.now();
      const result = await searchLocalCatalog(input, db);
      after[label] = {
        ms: Number((performance.now() - started).toFixed(2)),
        ids: result.page.items.map((item) => item.id),
        catalogItemRowsLoaded: result.stats.catalogItemRowsLoaded,
        barcodeIndexRowsLoaded: result.stats.barcodeIndexRowsLoaded,
        indexedKeysRead: result.stats.indexedKeysRead,
        usedIndexedPath: result.stats.usedIndexedPath,
        engineReconstructed: result.stats.engineReconstructed,
      };
    }

    expect(toArraySpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
    toArraySpy.mockRestore();
    replaceSpy.mockRestore();

    expect(after.nameSearch?.ids).toEqual(before.nameSearch?.ids);
    expect(after.nameSearch?.ids).toContain("item-0001234");
    expect(after.nameSearch?.usedIndexedPath).toBe("searchGrams");
    expect(after.nameSearch?.engineReconstructed).toBe(false);
    expect(after.nameSearch?.catalogItemRowsLoaded).toBeLessThan(SYNTHETIC_CATALOG_COUNT);
    expect(after.nameSearch?.catalogItemRowsLoaded).toBeLessThan(250);

    expect(after.exactBarcode?.ids).toEqual([LEADING_ZERO_ITEM_ID]);
    expect(after.exactBarcode?.usedIndexedPath).toBe("barcode");
    expect(after.exactBarcode?.barcodeIndexRowsLoaded).toBe(1);
    expect(after.exactBarcode?.catalogItemRowsLoaded).toBe(1);

    expect(after.duplicateBarcode?.ids.sort()).toEqual([DUPLICATE_ITEM_A_ID, DUPLICATE_ITEM_B_ID].sort());
    expect(after.duplicateBarcode?.usedIndexedPath).toBe("barcode");
    expect(after.duplicateBarcode?.catalogItemRowsLoaded).toBe(2);

    expect(after.parentLookup?.ids.sort()).toEqual(["item-0000006", "item-0000007"].sort());
    expect(after.parentLookup?.usedIndexedPath).toBe("parentId");
    expect(after.parentLookup?.catalogItemRowsLoaded).toBeLessThan(10);

    const variation = await searchLocalCatalog({ barcode: EXACT_VARIATION_BARCODE }, db);
    expect(variation.page.items[0]?.id).toBe(EXACT_VARIATION_ID);
    expect(variation.page.items[0]?.parentId).toBe(VARIABLE_PARENT_ID);
    expect(variation.page.items[0]?.kind).toBe("variation");
    expect(variation.stats.catalogItemRowsLoaded).toBe(1);

    const missing = await searchLocalCatalog({ barcode: "NO-SUCH-BARCODE" }, db);
    expect(missing.page.items).toEqual([]);
    expect(missing.stats.barcodeIndexRowsLoaded).toBe(1);
    expect(missing.stats.catalogItemRowsLoaded).toBe(0);

    const browse = await searchLocalCatalog({ limit: 50 }, db);
    expect(browse.stats.usedIndexedPath).toBe("idCursor");
    expect(browse.stats.catalogItemRowsLoaded).toBeLessThan(100);
    expect(browse.page.nextCursor).toBe(browse.page.items[browse.page.items.length - 1]?.id);
    const browseEngine = engine.search({ limit: 50 });
    expect(browse.page.items.map((item) => item.id)).toEqual(browseEngine.items.map((item) => item.id));

    await applyCatalogIncremental([createTombstoneUpdate()], "fixture-v2", db);
    const tombstoned = await searchLocalCatalog({ productId: TOMBSTONE_ITEM_ID }, db);
    expect(tombstoned.page.items).toEqual([]);
    const tombstoneBarcode = await searchLocalCatalog({ barcode: "TOM000000001" }, db);
    expect(tombstoneBarcode.page.items).toEqual([]);

    const port = createLocalCatalogPort({ db, correlationId: () => "11111111-1111-4111-8111-111111111111" });
    const viaPort = await port.search({ barcode: LEADING_ZERO_BARCODE });
    expect(viaPort.ok).toBe(true);
    if (viaPort.ok) {
      expect(viaPort.data.items[0]?.barcodes).toEqual([LEADING_ZERO_BARCODE]);
    }

    console.info(
      JSON.stringify({
        fixtureCount: records.length,
        before,
        after,
      }),
    );
  },
  120_000,
);

  test("local adapter cursor walk matches engine last-returned id semantics", async () => {
    const db = uniqueDb();
    const engine = new CatalogProjectionEngine();
    engine.rebuild(
      [
        cursorRecord("cursor-a", "Cursor item A"),
        cursorRecord("cursor-b", "Cursor item B"),
        cursorRecord("cursor-c", "Cursor item C"),
        cursorRecord("cursor-d", "Cursor item D"),
        cursorRecord("cursor-e", "Cursor item E"),
      ],
      "cursor-v1",
      "2026-09-13T20:00:00.000Z",
    );
    await persistCatalogEngine(engine, db);

    const first = await searchLocalCatalog({ limit: 2 }, db);
    expect(first.page.items.map((item) => item.id)).toEqual(["cursor-a", "cursor-b"]);
    expect(first.page.nextCursor).toBe("cursor-b");
    const second = await searchLocalCatalog({ limit: 2, cursor: first.page.nextCursor }, db);
    expect(second.page.items.map((item) => item.id)).toEqual(["cursor-c", "cursor-d"]);
    expect(second.page.nextCursor).toBe("cursor-d");
    const third = await searchLocalCatalog({ limit: 2, cursor: second.page.nextCursor }, db);
    expect(third.page.items.map((item) => item.id)).toEqual(["cursor-e"]);
    expect(third.page.nextCursor).toBeUndefined();
    expect(first.stats.usedIndexedPath).toBe("idCursor");
    expect(first.stats.catalogItemRowsLoaded).toBeLessThan(5);
  });

  test("Dexie v3 to v4 upgrade fills search grams and does not erase cart drafts", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const legacy = new LegacyV3Database(name);
    await legacy.open();
    await legacy.table("cartDrafts").put({
      cartId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      revision: 4,
      customer: { kind: "walkin" },
      locationId: "loc_a1",
      lines: [],
      updatedAt: "2026-09-13T20:00:00.000Z",
    });
    await legacy.table("catalogItems").put({
      id: "item-legacy",
      name: "Synthetic bulk item 1234",
      sku: "SKU-0001234",
      barcodes: ["B000000001234"],
      kind: "simple",
      stockStatus: "in_stock",
      projectionUpdatedAt: "2026-09-13T20:00:00.000Z",
      sourceSystem: "transitional-commerce",
      sourceItemId: "src-legacy",
      sourceVersion: "1",
      searchNormalized: "synthetic bulk item 1234 sku-0001234 b000000001234",
      tombstoned: false,
    });
    await legacy.table("barcodeIndex").put({ barcode: "B000000001234", itemIds: ["item-legacy"] });
    legacy.close();

    const db = openPosLocalDatabase(name);
    const drafts = createCartDraftStore(db);
    const restored = await drafts.load("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(restored?.revision).toBe(4);
    const result = await searchLocalCatalog({ query: "bulk item 1234" }, db);
    expect(result.page.items[0]?.id).toBe("item-legacy");
    expect(result.stats.usedIndexedPath).toBe("searchGrams");
    const barcode = await searchLocalCatalog({ barcode: "B000000001234" }, db);
    expect(barcode.page.items[0]?.id).toBe("item-legacy");
    await closePosLocalDatabase(name);
  });
});

class LegacyV3Database extends Dexie {
  constructor(name: string) {
    super(name);
    this.version(POS_LOCAL_SCHEMA_V1).stores({
      catalogItems: "id, parentId, kind, searchNormalized, tombstoned, sourceItemId",
      barcodeIndex: "barcode",
      catalogMeta: "key",
      cartDrafts: "cartId, updatedAt",
      journal: "id, status, idempotencyKey, transactionId, operation, [operation+idempotencyKey]",
      customers: "id, searchNormalized",
      schemaMeta: "key",
    });
    this.version(POS_LOCAL_SCHEMA_V2).stores({
      catalogItems: "id, parentId, kind, searchNormalized, tombstoned, sourceItemId",
      barcodeIndex: "barcode",
      catalogMeta: "key",
      cartDrafts: "cartId, updatedAt",
      journal: "id, status, idempotencyKey, transactionId, operation, [operation+idempotencyKey]",
      customers: "id, searchNormalized",
      schemaMeta: "key",
    });
    this.version(POS_LOCAL_SCHEMA_V3).stores({
      catalogItems: "id, parentId, kind, searchNormalized, tombstoned, sourceItemId",
      barcodeIndex: "barcode",
      catalogMeta: "key",
      cartDrafts: "cartId, updatedAt",
      journal: "id, status, idempotencyKey, transactionId, operation, [operation+idempotencyKey]",
      customers: "id, searchNormalized",
      schemaMeta: "key",
      kv: "key",
    });
  }
}

function cursorRecord(posItemId: string, name: string) {
  return {
    posItemId,
    sourceSystem: "transitional-commerce",
    sourceItemId: posItemId,
    sourceVersion: "1",
    name,
    sku: posItemId,
    barcodes: [] as string[],
    kind: "simple" as const,
    displayPrice: { minor: 100, currency: "GHS" as const },
    stockStatus: "in_stock" as const,
    sourceUpdatedAt: "2026-09-13T20:00:00.000Z",
  };
}
