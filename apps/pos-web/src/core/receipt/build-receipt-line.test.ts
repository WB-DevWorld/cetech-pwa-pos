import { describe, expect, test } from "vitest";
import type { QuoteLine } from "../../../../../docs/contracts/domain.generated";
import { validateCanonicalDef } from "../../server/quotes/canonical-schema";
import { buildReceiptLine, receiptLinesFromQuotePresentation } from "./build-receipt-line";
import type { CatalogPresentationItem } from "./catalog-presentation";
import { DEFAULT_RECEIPT_SETTINGS } from "./settings";
import { resolveEffectiveSku } from "./effective-sku";

const money = { minor: 1500, currency: "GHS" as const };

function quoteLine(input: { productId: string; variationId?: string }): QuoteLine {
  return {
    lineId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    productId: input.productId,
    ...(input.variationId ? { variationId: input.variationId } : {}),
    quantity: "1",
    unitPrice: money,
    subtotal: money,
    discount: { minor: 0, currency: "GHS" },
    tax: { minor: 0, currency: "GHS" },
    total: money,
    stockStatus: "in_stock",
    purchasable: true,
    problems: [],
  };
}

const parent: CatalogPresentationItem = {
  id: "p-cable",
  name: "Armoured Cable",
  sku: "CBL-ARM",
  kind: "variable",
};

const variationWithSku: CatalogPresentationItem = {
  id: "v-cable-red",
  name: "Armoured Cable",
  sku: "CBL-ARM-RED",
  kind: "variation",
  parentId: "p-cable",
  variationLabel: "Red",
};

const variationWithoutSku: CatalogPresentationItem = {
  id: "v-cable-blue",
  name: "Armoured Cable",
  kind: "variation",
  parentId: "p-cable",
  variationLabel: "Blue",
};

const simple: CatalogPresentationItem = {
  id: "p-hardener",
  name: "Epoxy Hardener 1L",
  sku: "HDN-1L",
  kind: "simple",
};

const simpleNoSku: CatalogPresentationItem = {
  id: "p-no-sku",
  name: "Uncoded Sample",
  kind: "simple",
};

describe("receipt SKU and line snapshot", () => {
  test("variation SKU overrides parent SKU", () => {
    expect(
      resolveEffectiveSku({ selected: variationWithSku, parent, showSku: true }),
    ).toBe("CBL-ARM-RED");
  });

  test("missing variation SKU falls back to parent SKU", () => {
    expect(
      resolveEffectiveSku({ selected: variationWithoutSku, parent, showSku: true }),
    ).toBe("CBL-ARM");
  });

  test("simple-product SKU works", () => {
    expect(resolveEffectiveSku({ selected: simple, showSku: true })).toBe("HDN-1L");
  });

  test("no available SKU omits the field", () => {
    expect(resolveEffectiveSku({ selected: simpleNoSku, showSku: true })).toBeUndefined();
    const line = buildReceiptLine({
      line: quoteLine({ productId: simpleNoSku.id }),
      selected: simpleNoSku,
      settings: { ...DEFAULT_RECEIPT_SETTINGS, showSku: true },
    });
    expect(line.sku).toBeUndefined();
    expect("sku" in line).toBe(false);
  });

  test("showSku=false omits SKU even when one exists", () => {
    expect(
      resolveEffectiveSku({ selected: variationWithSku, parent, showSku: false }),
    ).toBeUndefined();
    const line = buildReceiptLine({
      line: quoteLine({ productId: parent.id, variationId: variationWithSku.id }),
      selected: variationWithSku,
      parent,
      settings: DEFAULT_RECEIPT_SETTINGS,
    });
    expect(line.sku).toBeUndefined();
    expect(line.variationLabel).toBe("Red");
  });

  test("full original name remains available and source catalog name is unchanged", () => {
    const catalogName = "Epoxy Hardener 1L — industrial grade slow cure";
    const item: CatalogPresentationItem = { ...simple, name: catalogName };
    const line = buildReceiptLine({
      line: quoteLine({ productId: item.id }),
      selected: item,
      settings: {
        shortenProductNames: true,
        productNameMaxCharacters: 18,
        showSku: false,
      },
    });
    expect(line.name).toBe(catalogName);
    expect(line.displayName).not.toBe(catalogName);
    expect(Array.from(line.displayName ?? "")).toHaveLength(18);
    expect(item.name).toBe(catalogName);
    expect(validateCanonicalDef("ReceiptLine", line)).toBe(true);
  });

  test("does not copy productId or variationId into presentation fields", () => {
    const built = receiptLinesFromQuotePresentation({
      quote: {
        id: "quote-1",
        fingerprint: "0123456789abcdef0123456789abcdef",
        cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        cartRevision: 1,
        customer: { kind: "walkin" },
        locationId: "loc_a1",
        currency: "GHS",
        lines: [quoteLine({ productId: parent.id, variationId: variationWithSku.id })],
        subtotal: money,
        discount: { minor: 0, currency: "GHS" },
        tax: { minor: 0, currency: "GHS" },
        total: money,
        calculatedAt: "2026-09-18T12:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
        purchasable: true,
      },
      items: new Map([
        [parent.id, parent],
        [variationWithSku.id, variationWithSku],
      ]),
      settings: { ...DEFAULT_RECEIPT_SETTINGS, showSku: true },
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      throw new Error("expected receipt lines");
    }
    const line = built.lines[0];
    expect(line?.name).toBe("Armoured Cable");
    expect(line?.name).not.toBe(parent.id);
    expect(line?.variationLabel).toBe("Red");
    expect(line?.variationLabel).not.toBe(variationWithSku.id);
    expect(line?.sku).toBe("CBL-ARM-RED");
    expect(line?.displayName).toBe("Armoured Cable");
  });
});
