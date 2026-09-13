import { describe, expect, test } from "vitest";
import { customerSecondaryText, filterCustomerResults } from "./customerSearch";
import { SELL_TEST_CUSTOMERS } from "./sellTestCatalog";

describe("FE-03 customer search presentation", () => {
  test("searches by company and masked phone without exposing raw ids", () => {
    expect(filterCustomerResults(SELL_TEST_CUSTOMERS, "Buildworks").map((item) => item.id)).toEqual(["cust-buildworks"]);
    expect(filterCustomerResults(SELL_TEST_CUSTOMERS, "4488").map((item) => item.id)).toEqual(["cust-buildworks"]);
    expect(filterCustomerResults(SELL_TEST_CUSTOMERS, "Ada").map((item) => item.id)).toEqual(["cust-ada"]);
    expect(customerSecondaryText(SELL_TEST_CUSTOMERS[1]!)).toContain("Buildworks Ltd");
    expect(customerSecondaryText(SELL_TEST_CUSTOMERS[1]!)).toContain("+233");
    expect(customerSecondaryText(SELL_TEST_CUSTOMERS[1]!)).not.toContain("cust-buildworks");
  });

  test("b2b fixture is display context only", () => {
    expect(SELL_TEST_CUSTOMERS[1]?.kind).toBe("b2b");
    expect(JSON.stringify(SELL_TEST_CUSTOMERS)).not.toContain("pricingKey");
    expect(JSON.stringify(SELL_TEST_CUSTOMERS)).not.toContain("groupLabel");
  });
});
