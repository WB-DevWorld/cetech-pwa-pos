import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ProductCard } from "./components/ProductSearch";
import { CustomerPicker } from "./components/CustomerPicker";
import { SellScreen } from "./SellScreen";
import { SELL_TEST_CATALOG, SELL_TEST_CUSTOMERS } from "./state/sellTestCatalog";
import {
  applyBarcodeScan,
  applyCatalogAvailability,
  applySelectCustomer,
  createSellWorkspace,
} from "./state/sellWorkspace";

const deps = {
  createCartId: () => "cart-screen",
  createLineId: () => "line-screen",
};

describe("SellScreen presentation", () => {
  test("renders Sell workspace controls without demo barcode chips or money defaults", () => {
    const html = renderToStaticMarkup(
      createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        customers: SELL_TEST_CUSTOMERS,
        initialState: createSellWorkspace(deps, SELL_TEST_CATALOG),
        createCartId: deps.createCartId,
        createLineId: deps.createLineId,
      }),
    );
    expect(html).toContain("Scan barcode or search products");
    expect(html).toContain("Walk-in");
    expect(html).toContain("Your cart is empty");
    expect(html).toContain("Pay");
    expect(html).toContain("disabled");
    expect(html).toContain('id="product-search"');
    expect(html).toContain("New sale");
    expect(html).not.toContain("demo-barcodes");
    expect(html).not.toContain("Demo controls");
    expect(html).not.toContain("pricingKey");
    expect(html).not.toContain("GHS");
    expect(html).not.toContain("later task");
    expect(html).not.toContain("preparation pass");
    expect(html.toLowerCase()).not.toContain("adapter");
    expect(html).not.toContain("unwired");
  });

  test("shows unknown barcode as an alert without a Pay enablement", () => {
    let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "9999999999999", SELL_TEST_CATALOG, deps);
    const html = renderToStaticMarkup(
      createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        initialState: state,
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("9999999999999");
    expect(html).toContain("Product not found");
  });

  test("shows variation chooser copy when a parent product needs a selection", () => {
    let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0011223344556", SELL_TEST_CATALOG, deps);
    const html = renderToStaticMarkup(
      createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        initialState: state,
      }),
    );
    expect(html).toContain("Choose variation");
    expect(html).toContain("Scanning a variation barcode bypasses this chooser");
    expect(html).toContain("Red");
    expect(html).toContain("Black");
  });

  test("renders selected customer display and stale catalog copy", () => {
    let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
    state = applySelectCustomer(state, SELL_TEST_CUSTOMERS[0]!);
    state = applyCatalogAvailability(state, "stale");
    const html = renderToStaticMarkup(
      createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        customers: SELL_TEST_CUSTOMERS,
        initialState: state,
        catalogAvailability: "stale",
      }),
    );
    expect(html).toContain("Ada Boateng");
    expect(html).toContain("Catalog may be out of date.");
    expect(html).toContain("Reconnect to refresh before checkout.");
    expect(html.toLowerCase()).not.toContain("adapter");
  });

  test("b2b customer shows Wholesale as display context only", () => {
    let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
    state = applySelectCustomer(state, SELL_TEST_CUSTOMERS[1]!);
    const html = renderToStaticMarkup(
      createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        customers: SELL_TEST_CUSTOMERS,
        initialState: state,
      }),
    );
    expect(html).toContain("Buildworks Ltd");
    expect(html).toContain("Wholesale");
    expect(html).not.toContain("pricingKey");
    expect(html).not.toContain("cust-buildworks");
  });

  test("customer picker can match company and masked phone", () => {
    const html = renderToStaticMarkup(
      createElement(CustomerPicker, {
        customers: SELL_TEST_CUSTOMERS,
        selectedId: null,
        onSelect: () => undefined,
        onClear: () => undefined,
        onCancel: () => undefined,
      }),
    );
    expect(html).toContain("Ada Boateng");
    expect(html).toContain("Buildworks Ltd");
    expect(html).toContain("+233 •• ••• 4488");
    expect(html).toContain("Wholesale");
    expect(html).not.toContain("cust-ada");
    expect(html).not.toContain("cust-buildworks");
  });

  test("backorder is a truthful stock presentation and does not decide checkout", () => {
    const item = SELL_TEST_CATALOG.find((product) => product.stockStatus === "backorder")!;
    const html = renderToStaticMarkup(createElement(ProductCard, { item, onSelect: () => undefined }));
    expect(html).toContain("Backorder");
    expect(html).not.toContain("disabled");
  });
});
