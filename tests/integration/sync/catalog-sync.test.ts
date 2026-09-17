import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import type { ApiResult } from "../../../docs/contracts/ports";
import type { CatalogSyncPage } from "../../../apps/pos-web/src/core/catalog/sync-page";
import { CatalogProjectionEngine } from "../../../apps/pos-web/src/core/catalog/engine";
import { mapBridgeCatalogItem } from "../../../apps/pos-web/src/server/catalog/map-bridge-catalog";
import { createLocalCatalogPort } from "../../../apps/pos-web/src/local/catalog-repository";
import { createCartDraftStore } from "../../../apps/pos-web/src/local/cart-draft-store";
import { createOperationJournal } from "../../../apps/pos-web/src/local/operation-journal";
import { canonicalJson, sha256Hex } from "../../../apps/pos-web/src/local/canonical";
import {
  ensureCatalogProjection,
  inspectLocalCatalogProjection,
} from "../../../apps/pos-web/src/local/catalog-sync";
import { ensureCashierLocalSeed } from "../../../apps/pos-web/src/local/cashier-seed";
import {
  deletePosLocalDatabase,
  openPosLocalDatabase,
} from "../../../apps/pos-web/src/local/pos-local-db";
import { SYNTHETIC_CATALOG_COUNT, createSyntheticCatalogRecords } from "./fixtures/synthetic-catalog";

const DBS: string[] = [];
const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function uniqueDb() {
  const name = `cetech-pos-local-${crypto.randomUUID()}`;
  DBS.push(name);
  return openPosLocalDatabase(name);
}

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

function dto(overrides: Record<string, unknown> = {}) {
  return {
    sourceSystem: "woocommerce",
    sourceItemId: "101",
    sourceVersion: "2026-09-17T12:00:00.000Z:101",
    name: "Simple Switch",
    sku: "0123SKU",
    barcodes: ["0012345678901"],
    kind: "simple",
    purchasable: true,
    stockStatus: "in_stock",
    sourceUpdatedAt: "2026-09-17T12:00:00.000Z",
    deleted: false,
    ...overrides,
  };
}

function successPage(items: unknown[], nextCursor: string | null = null): ApiResult<CatalogSyncPage> {
  return {
    ok: true,
    correlationId: CORRELATION,
    data: {
      policy: "provider_required",
      sourceSystem: "woocommerce",
      items: items
        .map((item) => mapBridgeCatalogItem(item))
        .filter((item): item is NonNullable<typeof item> => item !== null),
      nextCursor,
    },
  };
}

function unavailable(): ApiResult<CatalogSyncPage> {
  return {
    ok: false,
    correlationId: CORRELATION,
    error: {
      code: "INTEGRATION_UNAVAILABLE",
      message: "catalog producer is unavailable",
      retryable: true,
      nextAction: "resolve",
    },
  };
}

describe("STG-04 catalog projection sync", () => {
  test("paginates with cursor and does not refetch completed pages", async () => {
    const db = uniqueDb();
    const queries: Array<{ cursor?: string; modifiedAfter?: string }> = [];
    const pages = new Map<string | undefined, { items: unknown[]; next: string | null }>([
      [undefined, { items: [dto({ sourceItemId: "1", name: "One" })], next: "1" }],
      ["1", { items: [dto({ sourceItemId: "2", name: "Two" })], next: null }],
    ]);
    const result = await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async (query) => {
        queries.push({ cursor: query.cursor, modifiedAfter: query.modifiedAfter });
        const page = pages.get(query.cursor);
        return successPage(page?.items ?? [], page?.next ?? null);
      },
    });
    expect(result.availability).toBe("fresh");
    expect(result.sourceMode).toBe("provider");
    expect(result.itemCount).toBe(2);
    expect(queries.map((query) => query.cursor)).toEqual([undefined, "1"]);
    expect(queries.every((query) => query.modifiedAfter === undefined)).toBe(true);
    const port = createLocalCatalogPort({ db, correlationId: () => CORRELATION });
    const found = await port.search({ query: "Two" });
    expect(found.ok && found.data.items[0]?.name).toBe("Two");
  });

  test("incremental update sends modifiedAfter instead of re-downloading the full catalog", async () => {
    const db = uniqueDb();
    const first = await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async () =>
        successPage([
          dto({ sourceItemId: "1", name: "One", sourceUpdatedAt: "2026-09-17T12:00:00.000Z" }),
        ]),
    });
    expect(first.itemCount).toBe(1);
    const queries: Array<{ cursor?: string; modifiedAfter?: string }> = [];
    const second = await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async (query) => {
        queries.push({ cursor: query.cursor, modifiedAfter: query.modifiedAfter });
        return successPage([
          dto({
            sourceItemId: "1",
            name: "One updated",
            sourceVersion: "2026-09-17T13:00:00.000Z:1",
            sourceUpdatedAt: "2026-09-17T13:00:00.000Z",
          }),
        ]);
      },
    });
    expect(second.itemCount).toBe(1);
    expect(queries[0]?.modifiedAfter).toBe("2026-09-17T12:00:00.000Z");
    const port = createLocalCatalogPort({ db, correlationId: () => CORRELATION });
    const found = await port.search({ query: "updated" });
    expect(found.ok && found.data.items[0]?.name).toBe("One updated");
  });

  test("tombstone incremental removes the item from search and barcode lookup", async () => {
    const db = uniqueDb();
    await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async () => successPage([dto({ sourceItemId: "7", barcodes: ["TOM000000007"] })]),
    });
    await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async () =>
        successPage([
          dto({
            sourceItemId: "7",
            deleted: true,
            barcodes: ["TOM000000007"],
            sourceUpdatedAt: "2026-09-17T14:00:00.000Z",
            sourceVersion: "2026-09-17T14:00:00.000Z:7",
          }),
        ]),
    });
    const port = createLocalCatalogPort({ db, correlationId: () => CORRELATION });
    const missing = await port.search({ barcode: "TOM000000007" });
    expect(missing.ok && missing.data.items).toEqual([]);
  });

  test("staging refuses synthetic fallback when the producer is unavailable and no projection exists", async () => {
    const db = uniqueDb();
    const result = await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async () => unavailable(),
    });
    expect(result.usedSyntheticSeed).toBe(false);
    expect(result.availability).toBe("unavailable");
    expect(result.itemCount).toBe(0);
    const inspection = await inspectLocalCatalogProjection(db);
    expect(inspection.liveCount).toBe(0);
    const names = (await db.catalogItems.toArray()).map((row) => row.name);
    expect(names.join(" ")).not.toContain("Epoxy Hardener");
    expect(names.join(" ")).not.toContain("Steel Conduit");
    expect(names.join(" ")).not.toContain("Armoured Cable");
  });

  test("ensureCashierLocalSeed is a no-op under provider_required", async () => {
    const db = uniqueDb();
    await ensureCashierLocalSeed(db, { policy: "provider_required" });
    expect(await db.catalogItems.count()).toBe(0);
  });

  test("local/test synthetic fixture still works when the producer is down", async () => {
    const db = uniqueDb();
    const result = await ensureCatalogProjection({
      db,
      policy: "synthetic_permitted",
      force: true,
      fetchPage: async () => unavailable(),
    });
    expect(result.usedSyntheticSeed).toBe(true);
    expect(result.availability).toBe("fresh");
    const port = createLocalCatalogPort({ db, correlationId: () => CORRELATION });
    const leading = await port.search({ barcode: "0012345" });
    expect(leading.ok && leading.data.items).toHaveLength(1);
  });

  test("stale/degraded refresh keeps a usable prior provider projection", async () => {
    const db = uniqueDb();
    await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async () => successPage([dto({ name: "Prior Switch" })]),
    });
    const result = await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async () => unavailable(),
    });
    expect(result.availability).toBe("stale");
    expect(result.producerUnavailable).toBe(true);
    expect(result.itemCount).toBe(1);
    const port = createLocalCatalogPort({ db, correlationId: () => CORRELATION });
    const found = await port.search({ query: "Prior" });
    expect(found.ok && found.data.items[0]?.name).toBe("Prior Switch");
  });

  test("cart draft and journal survive a provider projection rebuild", async () => {
    const db = uniqueDb();
    const drafts = createCartDraftStore(db);
    const journal = createOperationJournal(db);
    const cartId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    await drafts.save({
      cartId,
      revision: 3,
      customer: { kind: "walkin" },
      locationId: "loc_a1",
      lines: [
        {
          lineId: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
          productId: "p-keep",
          quantity: "2",
        },
      ],
      updatedAt: "2026-09-17T12:00:00.000Z",
    });
    const payload = JSON.stringify({ kind: "sale.prepare", n: 1 });
    const requestHash = await sha256Hex(canonicalJson(JSON.parse(payload) as unknown));
    await journal.appendBeforeSend(
      {
        id: "44444444-4444-4444-8444-444444444444",
        transactionId: "55555555-5555-4555-8555-555555555555",
        operation: "sale.prepare",
        idempotencyKey: "66666666-6666-4666-8666-666666666666",
        requestHash,
        payloadVersion: "1.0.0",
        status: "pending",
        attempts: 0,
        createdAt: "2026-09-17T12:00:00.000Z",
      },
      payload,
    );
    await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async () => successPage([dto({ sourceItemId: "1" }), dto({ sourceItemId: "2", name: "Two" })]),
    });
    const restored = await drafts.load(cartId);
    expect(restored?.revision).toBe(3);
    expect(restored?.lines[0]?.quantity).toBe("2");
    expect(await journal.pending()).toHaveLength(1);
  });

  test("local search and scan do not invoke the catalog producer per query", async () => {
    const db = uniqueDb();
    let fetches = 0;
    await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async () => {
        fetches += 1;
        return successPage([
          dto({ barcodes: ["0012345678901"] }),
          dto({ sourceItemId: "12", name: "Other", barcodes: ["5550001112223"] }),
        ]);
      },
    });
    expect(fetches).toBe(1);
    const port = createLocalCatalogPort({ db, correlationId: () => CORRELATION });
    await port.search({ query: "Switch" });
    await port.search({ barcode: "0012345678901" });
    await port.search({ query: "Other" });
    expect(fetches).toBe(1);
  });

  test("staging clears leftover synthetic seed instead of treating it as a usable projection", async () => {
    const db = uniqueDb();
    await ensureCashierLocalSeed(db, { policy: "synthetic_permitted" });
    expect(await db.catalogItems.count()).toBeGreaterThan(0);
    const result = await ensureCatalogProjection({
      db,
      policy: "provider_required",
      force: true,
      fetchPage: async () => unavailable(),
    });
    expect(result.availability).toBe("unavailable");
    expect(result.usedSyntheticSeed).toBe(false);
    const names = (await db.catalogItems.toArray()).map((row) => row.name).join(" ");
    expect(names).not.toContain("Epoxy Hardener");
  });

  test("5,000-item projection rebuild and search still hold after STG-04 mapping", () => {
    const records = createSyntheticCatalogRecords();
    expect(records.length).toBeGreaterThanOrEqual(SYNTHETIC_CATALOG_COUNT);
    const engine = new CatalogProjectionEngine();
    const started = performance.now();
    engine.rebuild(records, "stg-04-v1", "2026-09-17T12:00:00.000Z");
    const buildMs = performance.now() - started;
    expect(engine.meta().itemCount).toBeGreaterThanOrEqual(SYNTHETIC_CATALOG_COUNT);
    const search = engine.search({ query: "bulk item 1234" });
    expect(search.items.some((item) => item.id === "item-0001234")).toBe(true);
    expect(buildMs).toBeLessThan(5_000);
  });
});
