import { describe, expect, test } from "vitest";
import { childrenOf, isDigitBarcodeQuery, resolveBarcode } from "./barcodeResolution";
import { SELL_TEST_CATALOG } from "./sellTestCatalog";

describe("FE-03 barcode resolution", () => {
  test("preserves a leading-zero barcode string and maps it to one simple product", () => {
    const result = resolveBarcode("0012345", SELL_TEST_CATALOG);
    expect(result.kind).toBe("add");
    if (result.kind === "add") {
      expect(result.barcode).toBe("0012345");
      expect(result.item.id).toBe("p-leading-zero");
    }
  });

  test("exact variation barcode bypasses the chooser", () => {
    const result = resolveBarcode("0001112223334", SELL_TEST_CATALOG);
    expect(result.kind).toBe("add");
    if (result.kind === "add") {
      expect(result.item.kind).toBe("variation");
      expect(result.item.id).toBe("v-cable-red");
    }
  });

  test("parent product with multiple variations opens the chooser", () => {
    const result = resolveBarcode("0011223344556", SELL_TEST_CATALOG);
    expect(result.kind).toBe("chooser");
    if (result.kind === "chooser") {
      expect(result.product.id).toBe("p-cable");
      expect(childrenOf(result.product.id, SELL_TEST_CATALOG)).toHaveLength(2);
    }
  });

  test("unknown barcode does not choose an item", () => {
    expect(resolveBarcode("9999999999999", SELL_TEST_CATALOG)).toEqual({
      kind: "unknown",
      barcode: "9999999999999",
    });
  });

  test("barcode collision does not silently pick one match", () => {
    const result = resolveBarcode("5550001112223", SELL_TEST_CATALOG);
    expect(result.kind).toBe("collision");
    if (result.kind === "collision") {
      expect(result.matches.map((item) => item.id)).toEqual(["p-led", "p-db"]);
    }
  });

  test("digit-only search submit is treated as a barcode, names are not", () => {
    expect(isDigitBarcodeQuery("1234")).toBe(true);
    expect(isDigitBarcodeQuery("0012345")).toBe(true);
    expect(isDigitBarcodeQuery("Armoured Cable")).toBe(false);
    expect(isDigitBarcodeQuery("HDN-1L")).toBe(false);
  });
});
