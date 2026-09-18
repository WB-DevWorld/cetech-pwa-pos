import { describe, expect, test } from "vitest";
import type { QuoteLine } from "../../../../../docs/contracts/domain.generated";
import { validateCanonicalDef } from "../../server/quotes/canonical-schema";
import {
  captureSalePresentationLine,
  captureSalePresentationLines,
  freezeReceiptLine,
} from "./build-receipt-line";
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
    expect(resolveEffectiveSku({ selected: variationWithSku, parent })).toBe("CBL-ARM-RED");
  });

  test("missing variation SKU falls back to parent SKU", () => {
    expect(resolveEffectiveSku({ selected: variationWithoutSku, parent })).toBe("CBL-ARM");
  });

  test("simple-product SKU works", () => {
    expect(resolveEffectiveSku({ selected: simple })).toBe("HDN-1L");
  });

  test("no available SKU omits the field", () => {
    expect(resolveEffectiveSku({ selected: simpleNoSku })).toBeUndefined();
    const line = captureSalePresentationLine({
      line: quoteLine({ productId: simpleNoSku.id }),
      selected: simpleNoSku,
    });
    expect(line.sku).toBeUndefined();
    expect("sku" in line).toBe(false);
    expect("displayName" in line).toBe(false);
  });

  test("sale capture keeps full name and SKU; freeze omits SKU when showSku=false", () => {
    const captured = captureSalePresentationLine({
      line: quoteLine({ productId: parent.id, variationId: variationWithSku.id }),
      selected: variationWithSku,
      parent,
    });
    expect(captured.name).toBe("Armoured Cable");
    expect(captured.sku).toBe("CBL-ARM-RED");
    expect(captured.variationLabel).toBe("Red");
    expect("displayName" in captured).toBe(false);
    const frozen = freezeReceiptLine(captured, DEFAULT_RECEIPT_SETTINGS);
    expect(frozen.sku).toBeUndefined();
    expect("sku" in frozen).toBe(false);
    expect(frozen.variationLabel).toBe("Red");
    expect(frozen.displayName).toBe("Armoured Cable");
  });

  test("full original name remains available and source catalog name is unchanged", () => {
    const catalogName = "Epoxy Hardener 1L — industrial grade slow cure";
    const item: CatalogPresentationItem = { ...simple, name: catalogName };
    const captured = captureSalePresentationLine({
      line: quoteLine({ productId: item.id }),
      selected: item,
    });
    expect(captured.name).toBe(catalogName);
    expect("displayName" in captured).toBe(false);
    const frozen = freezeReceiptLine(captured, {
      shortenProductNames: true,
      productNameMaxCharacters: 18,
      showSku: false,
    });
    expect(frozen.name).toBe(catalogName);
    expect(frozen.displayName).not.toBe(catalogName);
    expect(Array.from(frozen.displayName ?? "")).toHaveLength(18);
    expect(item.name).toBe(catalogName);
    expect(validateCanonicalDef("ReceiptLine", frozen)).toBe(true);
  });

  test("does not copy productId or variationId into presentation fields", () => {
    const built = captureSalePresentationLines({
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
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      throw new Error("expected sale presentation lines");
    }
    const line = built.lines[0];
    expect(line?.name).toBe("Armoured Cable");
    expect(line?.name).not.toBe(parent.id);
    expect(line?.variationLabel).toBe("Red");
    expect(line?.variationLabel).not.toBe(variationWithSku.id);
    expect(line?.sku).toBe("CBL-ARM-RED");
    expect(line?.displayName).toBeUndefined();
  });

  test("variation SKU absent and parent without SKU omits SKU legitimately", () => {
    const parentNoSku: CatalogPresentationItem = {
      id: "p-cable",
      name: "Armoured Cable",
      kind: "variable",
    };
    const built = captureSalePresentationLines({
      quote: {
        id: "quote-1",
        fingerprint: "0123456789abcdef0123456789abcdef",
        cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        cartRevision: 1,
        customer: { kind: "walkin" },
        locationId: "loc_a1",
        currency: "GHS",
        lines: [quoteLine({ productId: parentNoSku.id, variationId: variationWithoutSku.id })],
        subtotal: money,
        discount: { minor: 0, currency: "GHS" },
        tax: { minor: 0, currency: "GHS" },
        total: money,
        calculatedAt: "2026-09-18T12:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
        purchasable: true,
      },
      items: new Map([
        [parentNoSku.id, parentNoSku],
        [variationWithoutSku.id, variationWithoutSku],
      ]),
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      throw new Error("expected sale presentation lines");
    }
    expect(built.lines[0]?.sku).toBeUndefined();
    expect("sku" in (built.lines[0] ?? {})).toBe(false);
  });

  test("quoted variation without parent presentation fails closed", () => {
    const built = captureSalePresentationLines({
      quote: {
        id: "quote-1",
        fingerprint: "0123456789abcdef0123456789abcdef",
        cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        cartRevision: 1,
        customer: { kind: "walkin" },
        locationId: "loc_a1",
        currency: "GHS",
        lines: [quoteLine({ productId: parent.id, variationId: variationWithoutSku.id })],
        subtotal: money,
        discount: { minor: 0, currency: "GHS" },
        tax: { minor: 0, currency: "GHS" },
        total: money,
        calculatedAt: "2026-09-18T12:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
        purchasable: true,
      },
      items: new Map([[variationWithoutSku.id, variationWithoutSku]]),
    });
    expect(built.ok).toBe(false);
    if (built.ok) {
      throw new Error("expected parent presentation failure");
    }
    expect(built.message).toContain("parent presentation");
  });
});
