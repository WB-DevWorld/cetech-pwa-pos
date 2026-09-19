import { describe, expect, test } from "vitest";
import { createSellWorkspace, applySelectCustomer, applyBarcodeScan } from "./state/sellWorkspace";
import { SELL_TEST_CATALOG, SELL_TEST_CUSTOMERS } from "./state/sellTestCatalog";
import { buildQuoteRequest } from "./runtime/quoteRequest";

describe("UX-04 next-sale quote customer", () => {
  test("quote request receives the selected retail/b2b customer id", () => {
    const deps = { createCartId: () => "cart-1", createLineId: () => "line-1" };
    let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
    state = applySelectCustomer(state, SELL_TEST_CUSTOMERS[0]!);
    state = applyBarcodeScan(state, "0012345", SELL_TEST_CATALOG, deps);
    const request = buildQuoteRequest(state, "loc_a1");
    expect(request?.customer).toEqual({ kind: "retail", customerId: "cust-ada" });
  });
});
