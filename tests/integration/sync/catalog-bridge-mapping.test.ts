import { describe, expect, test } from "vitest";
import { stableCatalogPosItemId } from "../../../apps/pos-web/src/core/catalog/stable-pos-id";
import {
  mapBridgeCatalogItem,
  mapBridgeCatalogItems,
} from "../../../apps/pos-web/src/server/catalog/map-bridge-catalog";

const SIMPLE = {
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
  displayPrice: { minor: 9999, currency: "GHS" },
  regularPrice: "99.99",
};

const VARIABLE = {
  sourceSystem: "woocommerce",
  sourceItemId: "200",
  sourceVersion: "2026-09-17T12:00:00.000Z:200",
  name: "Variable Cable",
  sku: "CABLE",
  barcodes: ["CABLE"],
  kind: "variable",
  purchasable: false,
  stockStatus: "in_stock",
  sourceUpdatedAt: "2026-09-17T12:00:00.000Z",
};

const VARIATION = {
  sourceSystem: "woocommerce",
  sourceItemId: "201",
  sourceParentId: "200",
  sourceVersion: "2026-09-17T12:00:00.000Z:201",
  name: "Variable Cable",
  sku: "000RED",
  barcodes: ["0001112223334"],
  kind: "variation",
  variationLabel: "Red",
  purchasable: true,
  stockStatus: "in_stock",
  sourceUpdatedAt: "2026-09-17T12:00:00.000Z",
};

describe("STG-04 bridge catalog mapping", () => {
  test("maps a simple product to an opaque posItemId and preserves SKU/barcode strings", () => {
    const mapped = mapBridgeCatalogItem(SIMPLE);
    expect(mapped).toBeDefined();
    if (!mapped) {
      return;
    }
    expect(mapped.posItemId).toBe(stableCatalogPosItemId("woocommerce", "101"));
    expect(mapped.posItemId).not.toBe("101");
    expect(mapped.sourceItemId).toBe("101");
    expect(mapped.sourceSystem).toBe("woocommerce");
    expect(mapped.sku).toBe("0123SKU");
    expect(mapped.barcodes).toEqual(["0012345678901"]);
    expect(mapped.kind).toBe("simple");
    expect(mapped.purchasable).toBe(true);
    expect(mapped.stockStatus).toBe("in_stock");
    expect(mapped.displayPrice).toEqual({ minor: 9999, currency: "GHS" });
    expect(Number.isInteger(mapped.displayPrice?.minor)).toBe(true);
  });

  test("maps a variable parent and resolves variation sourceParentId onto the parent posItemId", () => {
    const parent = mapBridgeCatalogItem(VARIABLE);
    const child = mapBridgeCatalogItem(VARIATION);
    expect(parent?.kind).toBe("variable");
    expect(child?.kind).toBe("variation");
    expect(child?.parentId).toBe(parent?.posItemId);
    expect(child?.parentId).toBe(stableCatalogPosItemId("woocommerce", "200"));
    expect(child?.sourceItemId).toBe("201");
    expect(child?.posItemId).not.toBe("201");
    expect(parent?.displayPrice).toBeUndefined();
    expect(child?.displayPrice).toBeUndefined();
  });

  test("preserves leading-zero barcodes and SKUs that a number would have stripped", () => {
    const mapped = mapBridgeCatalogItem({
      ...SIMPLE,
      sourceItemId: "9",
      sku: "00045",
      barcodes: ["00045", "0012345"],
    });
    expect(mapped?.sku).toBe("00045");
    expect(mapped?.barcodes).toEqual(["00045", "0012345"]);
  });

  test("duplicate barcodes remain distinct source items", () => {
    const a = mapBridgeCatalogItem({ ...SIMPLE, sourceItemId: "11", barcodes: ["5550001112223"] });
    const b = mapBridgeCatalogItem({ ...SIMPLE, sourceItemId: "12", name: "Other", barcodes: ["5550001112223"] });
    expect(a?.posItemId).not.toBe(b?.posItemId);
    expect(a?.barcodes).toEqual(["5550001112223"]);
    expect(b?.barcodes).toEqual(["5550001112223"]);
  });

  test("deleted products become tombstones without dropping source identity", () => {
    const mapped = mapBridgeCatalogItem({
      ...SIMPLE,
      sourceItemId: "404",
      deleted: true,
      stockStatus: "out_of_stock",
    });
    expect(mapped?.deleted).toBe(true);
    expect(mapped?.sourceItemId).toBe("404");
    expect(mapped?.sourceVersion).toBe("2026-09-17T12:00:00.000Z:101");
  });

  test("maps advisory displayPrice and ignores unrelated price-like keys", () => {
    const mapped = mapBridgeCatalogItems([SIMPLE])[0];
    expect(mapped?.displayPrice).toEqual({ minor: 9999, currency: "GHS" });
    expect(mapped?.displayPrice?.currency).toBe("GHS");
    expect(JSON.stringify(mapped)).not.toContain("99.99");
    expect(JSON.stringify(mapped)).not.toContain("regularPrice");
    expect(JSON.stringify(mapped)).not.toContain("b2bPrice");
    expect(JSON.stringify(mapped)).not.toContain("woodmartPrice");
  });

  test("does not let unsafe price fields override or fabricate displayPrice", () => {
    const unsafeOnly = mapBridgeCatalogItem({
      ...SIMPLE,
      displayPrice: undefined,
      regularPrice: "99.99",
      unitPrice: { minor: 8888, currency: "GHS" },
      b2bPrice: { minor: 1, currency: "GHS" },
      woodmartPrice: "12.00",
    });
    expect(unsafeOnly?.displayPrice).toBeUndefined();
    const preferred = mapBridgeCatalogItem({
      ...SIMPLE,
      displayPrice: { minor: 15500, currency: "GHS" },
      unitPrice: { minor: 999999, currency: "GHS" },
      b2bPrice: { minor: 1, currency: "GHS" },
      listPriceMinor: 200,
      listPriceCurrency: "USD",
    });
    expect(preferred?.displayPrice).toEqual({ minor: 15500, currency: "GHS" });
  });

  test("absence of advisory displayPrice remains absence", () => {
    const { displayPrice: _omit, regularPrice: _regular, ...plain } = SIMPLE;
    const mapped = mapBridgeCatalogItem(plain);
    expect(mapped?.displayPrice).toBeUndefined();
  });

  test("invalid displayPrice envelopes are omitted rather than coerced", () => {
    expect(mapBridgeCatalogItem({ ...SIMPLE, displayPrice: { minor: 12.5, currency: "GHS" } })?.displayPrice).toBeUndefined();
    expect(mapBridgeCatalogItem({ ...SIMPLE, displayPrice: { minor: -1, currency: "GHS" } })?.displayPrice).toBeUndefined();
    expect(mapBridgeCatalogItem({ ...SIMPLE, displayPrice: { minor: 100, currency: "" } })?.displayPrice).toBeUndefined();
    expect(mapBridgeCatalogItem({ ...SIMPLE, displayPrice: "155.00" })?.displayPrice).toBeUndefined();
  });

  test("listPriceMinor plus currency maps when displayPrice is absent", () => {
    const { displayPrice: _omit, ...plain } = SIMPLE;
    const mapped = mapBridgeCatalogItem({
      ...plain,
      listPriceMinor: 21500,
      listPriceCurrency: "GHS",
    });
    expect(mapped?.displayPrice).toEqual({ minor: 21500, currency: "GHS" });
  });

  test("posItemId is stable across mapping calls", () => {
    expect(mapBridgeCatalogItem(SIMPLE)?.posItemId).toBe(mapBridgeCatalogItem(SIMPLE)?.posItemId);
  });
});
