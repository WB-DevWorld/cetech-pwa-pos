import { describe, expect, test } from "vitest";
import { catalogAvailabilityCopy } from "../components/CatalogStatus";
import { SELL_TEST_CATALOG, SELL_TEST_CUSTOMERS } from "./sellTestCatalog";
import {
  applyBarcodeScan,
  applyCatalogAvailability,
  applyClearCustomer,
  applyDraftStatus,
  applyNameSearch,
  applyNewSale,
  applyProductSelect,
  applyQuantityChange,
  applyRemoveLine,
  applySelectCustomer,
  applyVariationSelect,
  createSellWorkspace,
  type SellWorkspaceDeps,
} from "./sellWorkspace";

function deps(): SellWorkspaceDeps {
  let carts = 0;
  let lines = 0;
  return {
    createCartId: () => `cart-${++carts}`,
    createLineId: () => `line-${++lines}`,
  };
}

describe("FE-03 sell workspace", () => {
  test("leading-zero barcode is preserved on the cart line", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345", SELL_TEST_CATALOG, workspaceDeps);
    expect(state.lines[0]?.scannedBarcode).toBe("0012345");
    expect(state.cartRevision).toBe(1);
  });

  test("repeated barcode scan increments the same line", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, workspaceDeps);
    state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, workspaceDeps);
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0]?.quantity).toBe("2");
    expect(state.cartRevision).toBe(2);
  });

  test("exact variation scan bypasses the chooser and adds that variation", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0001112223334", SELL_TEST_CATALOG, workspaceDeps);
    expect(state.notice).toBeNull();
    expect(state.lines).toHaveLength(1);
    expect(state.lines[0]?.variationId).toBe("v-cable-red");
  });

  test("parent multi-variation product requires the chooser and does not add a line", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0011223344556", SELL_TEST_CATALOG, workspaceDeps);
    expect(state.notice?.kind).toBe("chooser");
    expect(state.lines).toHaveLength(0);
    expect(state.cartRevision).toBe(0);
    const parent = SELL_TEST_CATALOG.find((item) => item.id === "p-cable")!;
    state = applyProductSelect(state, parent, SELL_TEST_CATALOG, workspaceDeps);
    expect(state.notice?.kind).toBe("chooser");
    expect(state.lines).toHaveLength(0);
  });

  test("unknown barcode does not mutate the cart", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "9999999999999", SELL_TEST_CATALOG, workspaceDeps);
    expect(state.notice).toEqual({ kind: "unknown", barcode: "9999999999999" });
    expect(state.lines).toHaveLength(0);
    expect(state.cartRevision).toBe(0);
  });

  test("partial barcode miss stays unknown even when substring search matches", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "1234", SELL_TEST_CATALOG, workspaceDeps);
    expect(state.notice).toEqual({ kind: "unknown", barcode: "1234" });
    expect(state.lines).toHaveLength(0);
    expect(state.cartRevision).toBe(0);
    expect(state.search.results.some((item) => item.barcodes.includes("0012345"))).toBe(true);
  });

  test("product-name search does not announce an unknown barcode", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "9999999999999", SELL_TEST_CATALOG, workspaceDeps);
    state = applyNameSearch(state, "Armoured", SELL_TEST_CATALOG);
    expect(state.notice).toBeNull();
    expect(state.search.results.some((item) => item.id === "p-cable")).toBe(true);
  });

  test("barcode collision does not silently pick one item", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "5550001112223", SELL_TEST_CATALOG, workspaceDeps);
    expect(state.notice?.kind).toBe("collision");
    expect(state.lines).toHaveLength(0);
    expect(state.cartRevision).toBe(0);
  });

  test("quantity edit and line removal increment cartRevision", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345", SELL_TEST_CATALOG, workspaceDeps);
    const afterAdd = state.cartRevision;
    state = applyQuantityChange(state, state.lines[0]!.lineId, "3");
    expect(state.cartRevision).toBe(afterAdd + 1);
    state = applyRemoveLine(state, state.lines[0]!.lineId);
    expect(state.cartRevision).toBe(afterAdd + 2);
    expect(state.lines).toHaveLength(0);
  });

  test("customer switch advances cartRevision and signals commercial invalidation", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345", SELL_TEST_CATALOG, workspaceDeps);
    const before = state.cartRevision;
    state = applySelectCustomer(state, SELL_TEST_CUSTOMERS[0]!);
    expect(state.selectedCustomer?.id).toBe("cust-ada");
    expect(state.cartRevision).toBe(before + 1);
    expect(state.commercialInvalidated).toBe(true);
    const afterSelect = state.cartRevision;
    state = applyClearCustomer(state);
    expect(state.selectedCustomer).toBeNull();
    expect(state.cartRevision).toBe(afterSelect + 1);
    expect(state.commercialInvalidated).toBe(true);
  });

  test("new sale resets cart, customer, and transient barcode state without claiming store wipes", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345", SELL_TEST_CATALOG, workspaceDeps);
    state = applySelectCustomer(state, SELL_TEST_CUSTOMERS[0]!);
    state = applyBarcodeScan(state, "9999999999999", SELL_TEST_CATALOG, workspaceDeps);
    const previousCartId = state.cartId;
    state = applyNewSale(state, SELL_TEST_CATALOG, workspaceDeps);
    expect(state.cartId).not.toBe(previousCartId);
    expect(state.cartRevision).toBe(0);
    expect(state.lines).toHaveLength(0);
    expect(state.selectedCustomer).toBeNull();
    expect(state.notice).toBeNull();
    expect(state.search.query).toBe("");
    expect(state.commercialInvalidated).toBe(false);
    expect(state.draftStatus.retainedLocally).toBe(false);
  });

  test("offline and stale presentation is adapter-driven and does not claim verified persistence", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyCatalogAvailability(state, "stale");
    expect(catalogAvailabilityCopy(state.catalogAvailability)?.title).toContain("out of date");
    expect(catalogAvailabilityCopy(state.catalogAvailability)?.body).toContain("Refresh products before checkout");
    state = applyCatalogAvailability(state, "offline_cached");
    const copy = catalogAvailabilityCopy(state.catalogAvailability);
    expect(copy?.body).toContain("Saved products are available");
    expect(copy?.body.toLowerCase()).not.toContain("verified");
    state = applyDraftStatus(state, { retainedLocally: true });
    expect(state.draftStatus.retainedLocally).toBe(true);
    expect(catalogAvailabilityCopy("unavailable")?.title).toContain("couldn't be loaded");
  });

  test("unavailable catalog blocks barcode, product, variation, and collision mutation", () => {
    const workspaceDeps = deps();
    const simple = SELL_TEST_CATALOG.find((item) => item.id === "p-hardener")!;
    const parent = SELL_TEST_CATALOG.find((item) => item.id === "p-cable")!;
    const red = SELL_TEST_CATALOG.find((item) => item.id === "v-cable-red")!;
    const led = SELL_TEST_CATALOG.find((item) => item.id === "p-led")!;

    let blocked = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    blocked = applyCatalogAvailability(blocked, "unavailable");
    const barcodeAttempt = applyBarcodeScan(blocked, "0012345678901", SELL_TEST_CATALOG, workspaceDeps);
    expect(barcodeAttempt.lines).toHaveLength(0);
    expect(barcodeAttempt.cartRevision).toBe(0);
    expect(barcodeAttempt.notice).toBeNull();
    const productAttempt = applyProductSelect(blocked, simple, SELL_TEST_CATALOG, workspaceDeps);
    expect(productAttempt.lines).toHaveLength(0);
    expect(productAttempt.cartRevision).toBe(0);

    let chooser = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    chooser = applyProductSelect(chooser, parent, SELL_TEST_CATALOG, workspaceDeps);
    expect(chooser.notice?.kind).toBe("chooser");
    chooser = applyCatalogAvailability(chooser, "unavailable");
    const variationAttempt = applyVariationSelect(chooser, red, workspaceDeps);
    expect(variationAttempt.lines).toHaveLength(0);
    expect(variationAttempt.cartRevision).toBe(0);

    let collision = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    collision = applyBarcodeScan(collision, "5550001112223", SELL_TEST_CATALOG, workspaceDeps);
    expect(collision.notice?.kind).toBe("collision");
    collision = applyCatalogAvailability(collision, "unavailable");
    const collisionAttempt = applyProductSelect(collision, led, SELL_TEST_CATALOG, workspaceDeps);
    expect(collisionAttempt.lines).toHaveLength(0);
    expect(collisionAttempt.cartRevision).toBe(0);
  });

  test("stale and offline_cached catalogs still accept product and barcode mutation", () => {
    const workspaceDeps = deps();
    const simple = SELL_TEST_CATALOG.find((item) => item.id === "p-hardener")!;

    let stale = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    stale = applyCatalogAvailability(stale, "stale");
    stale = applyBarcodeScan(stale, "0012345678901", SELL_TEST_CATALOG, workspaceDeps);
    expect(stale.lines).toHaveLength(1);
    expect(stale.cartRevision).toBe(1);
    stale = applyProductSelect(stale, simple, SELL_TEST_CATALOG, workspaceDeps);
    expect(stale.lines[0]?.quantity).toBe("2");

    let cached = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    cached = applyCatalogAvailability(cached, "offline_cached");
    cached = applyBarcodeScan(cached, "0012345", SELL_TEST_CATALOG, workspaceDeps);
    expect(cached.lines).toHaveLength(1);
    expect(cached.cartRevision).toBe(1);
  });

  test("repeated scan at maximum Quantity does not mutate the cart", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, workspaceDeps);
    state = applyQuantityChange(state, state.lines[0]!.lineId, "999999999");
    const before = state.cartRevision;
    state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, workspaceDeps);
    expect(state.lines[0]?.quantity).toBe("999999999");
    expect(state.cartRevision).toBe(before);
  });
});
