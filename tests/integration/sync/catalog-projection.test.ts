import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import { CatalogProjectionEngine } from "../../../apps/pos-web/src/core/catalog/engine";
import { createLocalCatalogPort, persistCatalogEngine } from "../../../apps/pos-web/src/local/catalog-repository";
import { createCartDraftStore } from "../../../apps/pos-web/src/local/cart-draft-store";
import {
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
  MISSING_BARCODE_ITEM_ID,
  SYNTHETIC_CATALOG_COUNT,
  TOMBSTONE_ITEM_ID,
  VARIABLE_PARENT_ID,
  createSyntheticCatalogRecords,
  createTombstoneUpdate,
} from "./fixtures/synthetic-catalog";

const DBS: string[] = [];

function uniqueDb(): ReturnType<typeof openPosLocalDatabase> {
  const name = `cetech-pos-local-${crypto.randomUUID()}`;
  DBS.push(name);
  return openPosLocalDatabase(name);
}

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

describe("CORE-04 catalog projection", () => {
  test("5,000-item fixture builds, searches, and looks up barcodes", async () => {
    const records = createSyntheticCatalogRecords();
    expect(records.length).toBeGreaterThanOrEqual(SYNTHETIC_CATALOG_COUNT);
    const engine = new CatalogProjectionEngine();
    const buildStarted = performance.now();
    engine.rebuild(records, "fixture-v1", "2026-09-13T20:00:00.000Z");
    const buildMs = performance.now() - buildStarted;
    expect(engine.meta().itemCount).toBeGreaterThanOrEqual(SYNTHETIC_CATALOG_COUNT);

    const searchStarted = performance.now();
    const search = engine.search({ query: "bulk item 1234" });
    const searchMs = performance.now() - searchStarted;
    expect(search.items.some((item) => item.id === "item-0001234")).toBe(true);

    const barcodeStarted = performance.now();
    const leading = engine.lookupBarcode(LEADING_ZERO_BARCODE);
    const barcodeMs = performance.now() - barcodeStarted;
    expect(leading.status).toBe("unique");
    if (leading.status === "unique") {
      expect(leading.item.id).toBe(LEADING_ZERO_ITEM_ID);
      expect(leading.item.barcodes).toEqual([LEADING_ZERO_BARCODE]);
      expect(leading.item.sku).toBe(LEADING_ZERO_BARCODE);
    }

    const duplicate = engine.lookupBarcode(DUPLICATE_BARCODE);
    expect(duplicate.status).toBe("duplicate");
    if (duplicate.status === "duplicate") {
      expect(duplicate.items.map((item) => item.id).sort()).toEqual(
        [DUPLICATE_ITEM_A_ID, DUPLICATE_ITEM_B_ID].sort(),
      );
    }

    const missing = engine.lookupBarcode("NO-SUCH-BARCODE");
    expect(missing.status).toBe("missing");

    const variation = engine.lookupBarcode(EXACT_VARIATION_BARCODE);
    expect(variation.status).toBe("unique");
    if (variation.status === "unique") {
      expect(variation.item.id).toBe(EXACT_VARIATION_ID);
      expect(variation.item.parentId).toBe(VARIABLE_PARENT_ID);
      expect(variation.item.kind).toBe("variation");
    }

    const children = engine.search({ parentId: VARIABLE_PARENT_ID });
    expect(children.items.map((item) => item.id).sort()).toEqual(["item-0000006", "item-0000007"].sort());

    engine.applyIncremental([createTombstoneUpdate()], "fixture-v2", "2026-09-13T20:05:00.000Z");
    expect(engine.get(TOMBSTONE_ITEM_ID)).toBeUndefined();
    expect(engine.lookupBarcode("TOM000000001").status).toBe("missing");
    expect(engine.search({ productId: TOMBSTONE_ITEM_ID }).items).toEqual([]);

    const noBarcode = engine.get(MISSING_BARCODE_ITEM_ID);
    expect(noBarcode?.barcodes).toEqual([]);

    console.info(
      JSON.stringify({
        fixtureCount: records.length,
        liveCount: engine.meta().itemCount,
        buildMs: Number(buildMs.toFixed(2)),
        searchMs: Number(searchMs.toFixed(2)),
        barcodeMs: Number(barcodeMs.toFixed(2)),
      }),
    );
  });

  test("CatalogPort.search maps duplicate and missing barcodes explicitly", async () => {
    const db = uniqueDb();
    const engine = new CatalogProjectionEngine();
    engine.rebuild(createSyntheticCatalogRecords(20), "fixture-v1", "2026-09-13T20:00:00.000Z");
    await persistCatalogEngine(engine, db);
    const port = createLocalCatalogPort({ db, correlationId: () => "11111111-1111-4111-8111-111111111111" });
    const missing = await port.search({ barcode: "UNKNOWN" });
    expect(missing.ok).toBe(true);
    if (missing.ok) {
      expect(missing.data.items).toEqual([]);
    }
    const duplicate = await port.search({ barcode: DUPLICATE_BARCODE });
    expect(duplicate.ok).toBe(true);
    if (duplicate.ok) {
      expect(duplicate.data.items).toHaveLength(2);
    }
    const exact = await port.search({ barcode: EXACT_VARIATION_BARCODE });
    expect(exact.ok).toBe(true);
    if (exact.ok) {
      expect(exact.data.items[0]?.id).toBe(EXACT_VARIATION_ID);
    }
  });

  test("projection rebuild preserves cart drafts in Dexie", async () => {
    const db = uniqueDb();
    const drafts = createCartDraftStore(db);
    const cartId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    await drafts.save({
      cartId,
      revision: 3,
      customer: { kind: "walkin" },
      locationId: "loc_a1",
      lines: [
        {
          lineId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
          productId: LEADING_ZERO_ITEM_ID,
          quantity: "2",
        },
      ],
      updatedAt: "2026-09-13T20:00:00.000Z",
    });
    const engine = new CatalogProjectionEngine();
    engine.rebuild(createSyntheticCatalogRecords(30), "fixture-v1", "2026-09-13T20:00:00.000Z");
    await persistCatalogEngine(engine, db);
    engine.rebuild(createSyntheticCatalogRecords(30), "fixture-v2", "2026-09-13T20:10:00.000Z");
    await persistCatalogEngine(engine, db);
    const restored = await drafts.load(cartId);
    expect(restored?.revision).toBe(3);
    expect(restored?.lines[0]?.quantity).toBe("2");
    expect(restored?.lines[0]?.productId).toBe(LEADING_ZERO_ITEM_ID);
    await closePosLocalDatabase(db.name);
  });
});
