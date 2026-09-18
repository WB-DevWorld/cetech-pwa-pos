import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CatalogProjectionEngine } from "../../../apps/pos-web/src/core/catalog/engine";
import { mapBridgeCatalogItem } from "../../../apps/pos-web/src/server/catalog/map-bridge-catalog";
import { ProductCard } from "../../../apps/pos-web/src/features/sell/components/ProductSearch";
import { catalogItemToSellView } from "../../../apps/pos-web/src/features/sell/runtime/mapCatalog";

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
});
