import { describe, expect, test } from "vitest";
import { CatalogProjectionEngine } from "../../apps/pos-web/src/core/catalog/engine";
import { mapTransitionalCatalogBatch } from "../../apps/pos-web/src/core/catalog/transitional-mapper";
import { CASHIER_SEED_CATALOG, CASHIER_SEED_CUSTOMERS } from "../../apps/pos-web/src/local/cashier-seed";
import type { CartDraftStore, CatalogPort, CustomerPort } from "../../docs/contracts/ports";
import type { CartDraft, CustomerSummary } from "../../docs/contracts/domain.generated";
import { lookupBarcodeViews, searchCatalogViews } from "../../apps/pos-web/src/features/sell/runtime/catalogLookup";
import { workspaceToCartDraft } from "../../apps/pos-web/src/features/sell/runtime/mapCartDraft";
import { restoreSellWorkspace } from "../../apps/pos-web/src/features/sell/runtime/restoreWorkspace";
import { applyBarcodeScan, applyNewSale, applySelectCustomer, createSellWorkspace } from "../../apps/pos-web/src/features/sell/state/sellWorkspace";
import { catalogItemToSellView } from "../../apps/pos-web/src/features/sell/runtime/mapCatalog";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function engineCatalog(): CatalogPort {
  const engine = new CatalogProjectionEngine();
  engine.rebuild(mapTransitionalCatalogBatch(CASHIER_SEED_CATALOG), "v1", "2026-09-13T20:00:00.000Z");
  return {
    async search(input) {
      return { ok: true, data: engine.search(input), correlationId: CORRELATION };
    },
  };
}

function memoryDrafts(): CartDraftStore & { rows: Map<string, CartDraft> } {
  const rows = new Map<string, CartDraft>();
  return {
    rows,
    async save(input) {
      const existing = rows.get(input.cartId);
      if (existing && existing.revision > input.revision) return;
      rows.set(input.cartId, input);
    },
    async load(cartId) {
      return rows.get(cartId) ?? null;
    },
  };
}

function memoryCustomers(rows: readonly CustomerSummary[] = CASHIER_SEED_CUSTOMERS): CustomerPort {
  return {
    async search(query) {
      const needle = query.trim().toLowerCase();
      const data = needle
        ? rows.filter(
            (row) =>
              row.displayName.toLowerCase().includes(needle) ||
              row.id.toLowerCase().includes(needle) ||
              (row.company ?? "").toLowerCase().includes(needle),
          )
        : [...rows];
      return { ok: true, data, correlationId: CORRELATION };
    },
  };
}

describe("FE-03 CatalogPort barcode and draft runtime", () => {
  test("leading-zero barcode is an exact unique CatalogPort hit", async () => {
    const result = await lookupBarcodeViews(engineCatalog(), "0012345");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.barcodes).toContain("0012345");
      expect(result.items[0]?.id).toBe("p-leading-zero");
    }
  });

  test("duplicate barcode returns multiple CatalogPort items for disambiguation", async () => {
    const result = await lookupBarcodeViews(engineCatalog(), "5550001112223");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items.map((item) => item.id).sort()).toEqual(["p-db", "p-led"]);
    }
  });

  test("unknown barcode is an empty CatalogPort page", async () => {
    const result = await lookupBarcodeViews(engineCatalog(), "NO-SUCH-BARCODE");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items).toHaveLength(0);
    }
  });

  test("exact variation barcode resolves the child, not the parent chooser", async () => {
    const result = await lookupBarcodeViews(engineCatalog(), "0001112223334");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items[0]?.kind).toBe("variation");
      expect(result.items[0]?.id).toBe("v-cable-red");
      expect(result.items[0]?.parentId).toBe("p-cable");
    }
  });

  test("name search uses CatalogPort and excludes variations from browse", async () => {
    const result = await searchCatalogViews(engineCatalog(), "Armoured");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.items.some((item) => item.kind === "variation")).toBe(false);
      expect(result.items.some((item) => item.id === "p-cable")).toBe(true);
    }
  });

  test("reload restores cart revision, line ids, and selected customer", async () => {
    const catalog = engineCatalog();
    const drafts = memoryDrafts();
    const customers = memoryCustomers();
    const deps = {
      createCartId: () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      createLineId: () => "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    };
    const page = await catalog.search({ query: "" });
    expect(page.ok).toBe(true);
    if (!page.ok) throw new Error("catalog");
    const views = page.data.items.map(catalogItemToSellView);
    let state = createSellWorkspace(deps, views);
    const slice = await lookupBarcodeViews(catalog, "0012345678901");
    expect(slice.ok).toBe(true);
    if (!slice.ok) throw new Error("barcode");
    state = applyBarcodeScan(state, "0012345678901", slice.items, deps);
    state = applyBarcodeScan(state, "0012345678901", slice.items, deps);
    state = applySelectCustomer(state, {
      id: "cust-buildworks",
      displayName: "Buildworks Ltd",
      kind: "b2b",
    });
    await drafts.save(workspaceToCartDraft(state, "loc-front-1", "2026-09-13T20:10:00.000Z"));
    const restored = await restoreSellWorkspace({
      catalog,
      customers,
      drafts,
      recallCartId: async () => state.cartId,
      browseCatalog: views,
      deps: {
        createCartId: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        createLineId: () => "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      },
      availability: "offline_cached",
    });
    expect(restored.cartId).toBe(state.cartId);
    expect(restored.cartRevision).toBe(state.cartRevision);
    expect(restored.lines[0]?.quantity).toBe("2");
    expect(restored.lines[0]?.lineId).toBe("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(restored.selectedCustomer?.id).toBe("cust-buildworks");
    expect(restored.draftStatus.retainedLocally).toBe(true);
    expect(restored.catalogAvailability).toBe("offline_cached");
  });

  test("new sale persists a distinct cart id at revision 0", async () => {
    const drafts = memoryDrafts();
    const deps = {
      createCartId: () => "ffffffff-ffff-4fff-8fff-ffffffffffff",
      createLineId: () => "11111111-1111-4111-8111-111111111111",
    };
    const catalog = engineCatalog();
    const page = await catalog.search({ query: "" });
    if (!page.ok) throw new Error("catalog");
    const views = page.data.items.map(catalogItemToSellView);
    let state = createSellWorkspace(
      { createCartId: () => "22222222-2222-4222-8222-222222222222", createLineId: deps.createLineId },
      views,
    );
    const slice = await lookupBarcodeViews(catalog, "0012345");
    if (!slice.ok) throw new Error("barcode");
    state = applyBarcodeScan(state, "0012345", slice.items, {
      createCartId: () => "22222222-2222-4222-8222-222222222222",
      createLineId: deps.createLineId,
    });
    await drafts.save(workspaceToCartDraft(state, "loc-front-1", "2026-09-13T20:11:00.000Z"));
    const reset = applyNewSale(state, views, deps);
    await drafts.save(workspaceToCartDraft(reset, "loc-front-1", "2026-09-13T20:12:00.000Z"));
    const previous = await drafts.load(state.cartId);
    const next = await drafts.load(reset.cartId);
    expect(previous?.revision).toBeGreaterThan(0);
    expect(next?.cartId).toBe("ffffffff-ffff-4fff-8fff-ffffffffffff");
    expect(next?.revision).toBe(0);
    expect(next?.lines).toHaveLength(0);
    expect(next?.customer).toEqual({ kind: "walkin" });
  });

  test("catalogItemToSellView passes advisory displayPrice through unchanged", () => {
    const view = catalogItemToSellView({
      id: "p-display",
      name: "Display priced item",
      barcodes: ["001"],
      kind: "simple",
      stockStatus: "in_stock",
      projectionUpdatedAt: "2026-09-13T20:00:00.000Z",
      displayPrice: { minor: 15500, currency: "GHS" },
    });
    expect(view.displayPrice).toEqual({ minor: 15500, currency: "GHS" });
    const omitted = catalogItemToSellView({
      id: "p-none",
      name: "No display price",
      barcodes: [],
      kind: "simple",
      stockStatus: "in_stock",
      projectionUpdatedAt: "2026-09-13T20:00:00.000Z",
    });
    expect(omitted.displayPrice).toBeUndefined();
  });
});
