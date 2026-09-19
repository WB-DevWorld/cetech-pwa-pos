import { describe, expect, test } from "vitest";
import { productBadges, productStockCopy } from "./productPresentation";
import type { SellProductView } from "./sellView";

const base = (overrides: Partial<SellProductView>): SellProductView => ({
  id: "p-1",
  name: "Wholesale Quantity Sale Demo",
  sku: "B2B-HIGH-STOCK",
  barcodes: ["1"],
  kind: "simple",
  stockStatus: "in_stock",
  ...overrides,
});

describe("product presentation badges", () => {
  test("does not invent commercial badges from product names or SKUs", () => {
    expect(productBadges(base({}))).toEqual([]);
    expect(productStockCopy(base({})).text).toBe("In stock");
  });

  test("variable kind is the only commercial-looking badge inferred from structured state", () => {
    expect(productBadges(base({ kind: "variable" }))).toEqual([
      { id: "variable", label: "Variable product", tone: "info" },
    ]);
  });

  test("supports multiple structured badges without inventing high-stock or wholesale", () => {
    const badges = productBadges(base({ kind: "variable", stockStatus: "low_stock" }));
    expect(badges.map((badge) => badge.label)).toEqual(["Variable product", "Low stock"]);
    expect(badges.some((badge) => /wholesale|sale price|high stock|quantity/i.test(badge.label))).toBe(false);
  });
});
