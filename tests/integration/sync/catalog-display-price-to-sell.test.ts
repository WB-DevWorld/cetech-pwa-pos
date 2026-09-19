import "fake-indexeddb/auto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";
import type { CatalogSourceRecord } from "../../../apps/pos-web/src/core/catalog/source";
import { CatalogProjectionEngine } from "../../../apps/pos-web/src/core/catalog/engine";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../../apps/pos-web/src/config/auth";
import { createEphemeralInMemoryStaffSessionStore } from "../../../apps/pos-web/src/server/auth/session-store";
import { createMemoryCatalogProjectionStore } from "../../../apps/pos-web/src/server/catalog/catalog-projection-store";
import { handleCatalogSync } from "../../../apps/pos-web/src/server/catalog/handle-catalog-sync";
import { mapBridgeCatalogItem } from "../../../apps/pos-web/src/server/catalog/map-bridge-catalog";
import { ProductCard } from "../../../apps/pos-web/src/features/sell/components/ProductSearch";
import { catalogItemToSellView } from "../../../apps/pos-web/src/features/sell/runtime/mapCatalog";
import {
  createLocalCatalogPort,
  loadCatalogEngine,
  rebuildCatalogProjection,
} from "../../../apps/pos-web/src/local/catalog-repository";
import { deletePosLocalDatabase, openPosLocalDatabase } from "../../../apps/pos-web/src/local/pos-local-db";

const DBS: string[] = [];

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

const BRIDGE_ROW = {
  sourceSystem: "woocommerce",
  sourceItemId: "101",
  sourceVersion: "2026-09-17T12:00:00.000Z:101",
  name: "Simple Switch",
  sku: "0123SKU",
  barcodes: ["0012345678901"],
  kind: "simple" as const,
  purchasable: true,
  stockStatus: "in_stock" as const,
  sourceUpdatedAt: "2026-09-17T12:00:00.000Z",
  deleted: false,
  displayPrice: { minor: 15500, currency: "GHS" },
  unitPrice: { minor: 999999, currency: "GHS" },
  b2bPrice: { minor: 1, currency: "GHS" },
  regularPrice: "99.99",
};

describe("advisory displayPrice reaches Sell product cards", () => {
  test("Woo bridge row maps through projection into ProductCard as GHS 155.00", () => {
    const record = mapBridgeCatalogItem(BRIDGE_ROW);
    expect(record?.displayPrice).toEqual({ minor: 15500, currency: "GHS" });
    if (!record) {
      return;
    }
    const engine = new CatalogProjectionEngine();
    engine.rebuild([record], record.sourceVersion, record.sourceUpdatedAt);
    const item = engine.get(record.posItemId);
    expect(item?.displayPrice).toEqual({ minor: 15500, currency: "GHS" });
    if (!item) {
      return;
    }
    const view = catalogItemToSellView(item);
    expect(view.displayPrice).toEqual({ minor: 15500, currency: "GHS" });
    const html = renderToStaticMarkup(createElement(ProductCard, { item: view, onSelect: () => undefined }));
    expect(html).toContain("GHS 155.00");
    expect(html).not.toContain("GHS 9,999.99");
    expect(html).not.toContain("GHS 0.01");
    expect(html).not.toContain("99.99");
  });

  test("missing advisory displayPrice stays absent on the card", () => {
    const { displayPrice: _omit, ...plain } = BRIDGE_ROW;
    const record = mapBridgeCatalogItem(plain);
    expect(record?.displayPrice).toBeUndefined();
    if (!record) {
      return;
    }
    const engine = new CatalogProjectionEngine();
    engine.rebuild([record], record.sourceVersion, record.sourceUpdatedAt);
    const item = engine.get(record.posItemId);
    if (!item) {
      return;
    }
    const view = catalogItemToSellView(item);
    expect(view.displayPrice).toBeUndefined();
    const html = renderToStaticMarkup(createElement(ProductCard, { item: view, onSelect: () => undefined }));
    expect(html).not.toContain("GHS ");
    expect(html).toContain("product-price-empty");
  });

  test("advisory displayPrice survives local IndexedDB reload after catalog sync", async () => {
    const store = createEphemeralInMemoryStaffSessionStore();
    const csrf = "csrf-catalog-token";
    const sessionId = await store.create(
      {
        actorId: "cashier_a",
        displayName: "Cashier A",
        organizationId: "org_a",
        locationIds: ["loc_a1"],
        capabilities: ["ui.hint.only"],
        expiresAt: "2026-09-17T22:00:00.000Z",
      },
      csrf,
      new Date("2026-09-17T22:00:00.000Z"),
    );
    const projectionStore = createMemoryCatalogProjectionStore();
    const result = await handleCatalogSync({
      correlationIdHeader: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      cookieHeader: `${STAFF_SESSION_COOKIE}=${sessionId}; ${STAFF_CSRF_COOKIE}=${csrf}`,
      now: new Date("2026-09-17T12:00:00.000Z"),
      appEnv: "staging",
      sessionStore: store,
      projectionStore,
      bridge: {
        async fetchPage(_query, correlationId) {
          return {
            ok: true,
            correlationId,
            page: { items: [BRIDGE_ROW], nextCursor: null },
          };
        },
      },
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      return;
    }
    const synced = result.body.data.items[0] as CatalogSourceRecord;
    expect(synced.displayPrice).toEqual({ minor: 15500, currency: "GHS" });
    const identity = await projectionStore.loadByItemIds("org_a", [synced.posItemId]);
    expect(JSON.stringify(identity)).not.toContain("15500");
    expect(JSON.stringify(identity)).not.toContain("displayPrice");

    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    await rebuildCatalogProjection(result.body.data.items, synced.sourceVersion, db);
    const reopened = openPosLocalDatabase(name);
    const engine = await loadCatalogEngine(reopened);
    expect(engine.get(synced.posItemId)?.displayPrice).toEqual({ minor: 15500, currency: "GHS" });
    const catalog = createLocalCatalogPort({
      db: reopened,
      correlationId: () => "55555555-5555-4555-8555-555555555555",
    });
    const found = await catalog.search({ barcode: "0012345678901" });
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.data.items[0]?.displayPrice).toEqual({ minor: 15500, currency: "GHS" });
    }
  });
});
