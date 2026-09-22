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
  applyDraftStatus,
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
    expect(html).toContain("Scan barcode or search products, SKU");
    expect(html).toContain("Walk-in");
    expect(html).toContain("Your cart is empty");
    expect(html).toContain("Pay");
    expect(html).toContain("disabled");
    expect(html).toContain('id="product-search"');
    expect(html).toContain('class="sr-only"');
    expect(html).toContain(">Sell<");
    expect(html).not.toContain("page-head");
    expect(html).toContain("Clear");
    expect(html).toContain("Cart");
    expect(html).not.toContain("Rev 0");
    expect(html).not.toContain(">Scan<");
    expect(html).not.toContain("New sale");
    expect(html).not.toContain("demo-barcodes");
    expect(html).not.toContain("Demo controls");
    expect(html).not.toContain("pricingKey");
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
    expect(html).toContain('role="status"');
    expect(html).toContain("9999999999999");
    expect(html).toContain("Product not found for barcode");
    expect(html).toContain('data-sell-toast="unknown-barcode"');
    expect(html).not.toContain("sell-dialog");
    expect(html).not.toContain("Pay GHS");
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

  test("product cards show advisory display price, SKU, and structured badges only", () => {
    const priced = SELL_TEST_CATALOG.find((product) => product.id === "p-hardener")!;
    const html = renderToStaticMarkup(createElement(ProductCard, { item: priced, onSelect: () => undefined }));
    expect(html).toContain("Epoxy Hardener 1L");
    expect(html).toContain("SKU HDN-1L");
    expect(html).toContain("In stock");
    expect(html).toContain("GHS 155.00");
    expect(html).toContain("product-price");
    expect(html).not.toContain("Wholesale");
    expect(html).not.toContain("Quantity price");
    expect(html).not.toContain("High stock");
  });

  test("omits price when catalog displayPrice is absent and keeps the full name when clamped", () => {
    const longName =
      "Extra Long POS Product Name That Must Remain Intact For Accessibility Even When The Card Clamps Two Lines";
    const html = renderToStaticMarkup(
      createElement(ProductCard, {
        item: {
          id: "p-long",
          name: longName,
          sku: "LONG-1",
          barcodes: ["111"],
          kind: "simple",
          stockStatus: "in_stock",
        },
        onSelect: () => undefined,
      }),
    );
    expect(html).toContain(longName);
    expect(html).toContain("product-name");
    expect(html).not.toContain("GHS");
    expect(html).not.toContain("product-badge");
  });

  test("variable products get a badge and out-of-stock cards stay readable and non-addable", () => {
    const variable = SELL_TEST_CATALOG.find((product) => product.kind === "variable")!;
    const variableHtml = renderToStaticMarkup(createElement(ProductCard, { item: variable, onSelect: () => undefined }));
    expect(variableHtml).toContain("Variable product");
    const out = renderToStaticMarkup(
      createElement(ProductCard, {
        item: {
          id: "p-oos",
          name: "3-Pole Contactor",
          sku: "CON-32A",
          barcodes: ["222"],
          kind: "simple",
          stockStatus: "out_of_stock",
          displayPrice: { minor: 23500, currency: "GHS" },
        },
        onSelect: () => undefined,
      }),
    );
    expect(out).toContain("Out of stock");
    expect(out).toContain("disabled");
    expect(out).toContain("GHS 235.00");
    expect(out).toContain("3-Pole Contactor");
  });

  test("variable parent cards render min–max, equal, and unavailable advisory prices", () => {
    const range = renderToStaticMarkup(
      createElement(ProductCard, {
        item: {
          id: "p-range",
          name: "Variable range parent",
          sku: "VAR-R",
          barcodes: [],
          kind: "variable",
          stockStatus: "in_stock",
          priceView: {
            kind: "range",
            min: { minor: 6500, currency: "GHS" },
            max: { minor: 56700, currency: "GHS" },
          },
        },
        onSelect: () => undefined,
      }),
    );
    expect(range).toContain("GHS 65.00 – GHS 567.00");
    const equal = renderToStaticMarkup(
      createElement(ProductCard, {
        item: {
          id: "p-equal",
          name: "Equal children",
          barcodes: [],
          kind: "variable",
          stockStatus: "in_stock",
          priceView: { kind: "single", amount: { minor: 6500, currency: "GHS" } },
        },
        onSelect: () => undefined,
      }),
    );
    expect(equal).toContain("GHS 65.00");
    expect(equal).not.toContain("GHS 65.00 – GHS 65.00");
    const missing = renderToStaticMarkup(
      createElement(ProductCard, {
        item: {
          id: "p-missing",
          name: "Unpriced variable",
          barcodes: [],
          kind: "variable",
          stockStatus: "in_stock",
          priceView: { kind: "unavailable" },
        },
        onSelect: () => undefined,
      }),
    );
    expect(missing).toContain("Price unavailable");
  });

  test("healthy local draft is an inline status, not a full-width banner", () => {
    let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
    state = applyDraftStatus(state, { retainedLocally: true });
    const html = renderToStaticMarkup(
      createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        initialState: state,
        draftStatus: { retainedLocally: true },
      }),
    );
    expect(html).toContain("Saved on this device");
    expect(html).not.toContain("This sale is saved on this device.");
    expect(html).toContain("products-meta-draft");
  });

  test("unavailable catalog hides the product grid", () => {
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
    expect(html).not.toContain(">Scan<");
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

  test("duplicate barcode is a blocking chooser that does not guess", () => {
    let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "5550001112223", SELL_TEST_CATALOG, deps);
    expect(state.lines).toHaveLength(0);
    expect(state.cartRevision).toBe(0);
    const html = renderToStaticMarkup(
      createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        initialState: state,
      }),
    );
    expect(html).toContain("Duplicate barcode match");
    expect(html).toContain("Barcode collision detected.");
    expect(html).toContain("36W LED Panel Light");
    expect(html).toContain("12-Way Distribution Board");
    expect(html).not.toContain("p-led");
    expect(html).not.toContain("Demo controls");
  });
});
