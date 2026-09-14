import { describe, expect, test } from "vitest";
import {
  catalogSearchGrams,
  paginateProjectedItems,
  pickIndexedSearchGram,
  resolveCatalogSearchLimit,
} from "./query";
import type { ProjectedCatalogItem } from "./source";

function item(id: string, name: string): ProjectedCatalogItem {
  return {
    id,
    name,
    barcodes: [],
    kind: "simple",
    stockStatus: "in_stock",
    projectionUpdatedAt: "2026-09-13T20:00:00.000Z",
    sourceSystem: "transitional-commerce",
    sourceItemId: id,
    sourceVersion: "1",
    searchNormalized: name.toLowerCase(),
    tombstoned: false,
  };
}

describe("HARDEN-01 catalog query helpers", () => {
  test("pickIndexedSearchGram prefers a digit token so bulk name search is selective", () => {
    expect(pickIndexedSearchGram("bulk item 1234")).toBe("123");
    expect(pickIndexedSearchGram("0001234567890")).toBe("000");
    expect(pickIndexedSearchGram("Adhesive")).toBe("adh");
    expect(pickIndexedSearchGram("  ")).toBeUndefined();
  });

  test("catalogSearchGrams cover name substring and raw barcode fragments", () => {
    const grams = catalogSearchGrams("synthetic bulk item 1234", ["0001234567890"]);
    expect(grams).toContain("123");
    expect(grams).toContain("000");
    expect(grams).toContain("syn");
  });

  test("paginateProjectedItems uses the last returned id as cursor", () => {
    const page = paginateProjectedItems([item("c", "C"), item("a", "A"), item("b", "B")], undefined, 2);
    expect(page.items.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("b");
    const second = paginateProjectedItems([item("c", "C"), item("a", "A"), item("b", "B")], page.nextCursor, 2);
    expect(second.items.map((entry) => entry.id)).toEqual(["c"]);
    expect(second.nextCursor).toBeUndefined();
  });

  test("resolveCatalogSearchLimit caps at 200 and defaults to 50", () => {
    expect(resolveCatalogSearchLimit(undefined)).toBe(50);
    expect(resolveCatalogSearchLimit(0)).toBe(50);
    expect(resolveCatalogSearchLimit(12)).toBe(12);
    expect(resolveCatalogSearchLimit(500)).toBe(200);
  });
});
