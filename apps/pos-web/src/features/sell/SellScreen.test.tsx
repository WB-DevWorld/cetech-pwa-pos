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
    expect(html).toContain("Scan or search for a product");
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
    expect(html).toContain("Products may be out of date.");
    expect(html).toContain("Refresh products before checkout.");
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

  test("unavailable catalog disables Scan and hides the product grid", () => {
    const html = renderToStaticMarkup(
      createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        initialState: createSellWorkspace(deps, SELL_TEST_CATALOG),
        catalogAvailability: "unavailable",
        createCartId: deps.createCartId,
        createLineId: deps.createLineId,
      }),
    );
    expect(html).toContain("couldn&#x27;t be loaded");
    expect(html).toMatch(/<button class="btn" type="button" disabled="">Scan<\/button>/);
    expect(html).not.toContain("product-grid");
  });

  test("renders supplied quote and eligibility states without enabling Pay", () => {
    let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, deps);
    const html = renderToStaticMarkup(
      createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        initialState: state,
        quote: {
          status: "failed",
          revision: state.cartRevision,
          code: "INTEGRATION_UNAVAILABLE",
          message: "Pricing unavailable — cart saved",
        },
        eligibility: {
          allowed: false,
          reason: "CONNECTION_REQUIRED",
          message: "Connection required to confirm price",
        },
      }),
    );
    expect(html).toContain('data-quote-status="failed"');
    expect(html).toContain("couldn&#x27;t be checked");
    expect(html).toContain("Technical details");
    expect(html).toContain("INTEGRATION_UNAVAILABLE");
    expect(html).toContain("Pricing unavailable — cart saved");
    expect(html).toContain('data-eligibility-reason="CONNECTION_REQUIRED"');
    expect(html).toMatch(/pay-btn[^>]*disabled/);
    expect(html).not.toContain("PRICING_UNAVAILABLE");
  });

  test("does not keep a prior revision quote after the cart revision advances", () => {
    let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, deps);
    expect(state.cartRevision).toBe(1);
    const html = renderToStaticMarkup(
      createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        initialState: { ...state, cartRevision: 2 },
        quote: {
          status: "confirmed",
          revision: 1,
          quote: { total: { minor: 2500, currency: "GHS" } },
        },
        eligibility: { allowed: true },
      }),
    );
    expect(html).toContain('data-quote-status="stale"');
    expect(html).toContain("Price needs to be checked again.");
    expect(html).not.toContain("GHS 25.00");
    expect(html).toContain('data-eligibility-reason="QUOTE_STALE"');
    expect(html).toMatch(/pay-btn[^>]*disabled/);
  });
});
