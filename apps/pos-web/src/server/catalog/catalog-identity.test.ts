import { describe, expect, test } from "vitest";
import type { Quote, QuoteRequest } from "../../../../../docs/contracts/domain.generated";
import { stableCatalogPosItemId } from "../../core/catalog/stable-pos-id";
import {
  restoreQuoteToPosIds,
  translateQuoteRequestToProvider,
  type CatalogIdentityMapping,
} from "./catalog-identity";

const POS_PRODUCT = stableCatalogPosItemId("woocommerce", "101");
const POS_VARIATION = stableCatalogPosItemId("woocommerce", "202");
const LINE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const REQUEST: QuoteRequest = {
  cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  cartRevision: 3,
  customer: { kind: "walkin" },
  locationId: "loc_a1",
  lines: [{ lineId: LINE_ID, productId: POS_PRODUCT, quantity: "2" }],
};

const VARIATION_REQUEST: QuoteRequest = {
  ...REQUEST,
  lines: [{ lineId: LINE_ID, productId: POS_PRODUCT, variationId: POS_VARIATION, quantity: "2" }],
};

function mapping(
  itemId: string,
  sourceItemId: string,
  extra?: Partial<CatalogIdentityMapping>,
): CatalogIdentityMapping {
  return {
    itemId,
    sourceSystem: "woocommerce",
    sourceItemId,
    tombstoned: false,
    ...extra,
  };
}

function money(minor: number) {
  return { minor, currency: "GHS" as const };
}

function quoteFrom(request: QuoteRequest, productId: string, variationId?: string): Quote {
  const unit = money(1500);
  const zero = money(0);
  return {
    id: "quote-1",
    fingerprint: "0123456789abcdef0123456789abcdef",
    cartId: request.cartId,
    cartRevision: request.cartRevision,
    customer: request.customer,
    locationId: request.locationId,
    currency: "GHS",
    lines: [
      {
        lineId: LINE_ID,
        productId,
        quantity: "2",
        unitPrice: unit,
        subtotal: unit,
        discount: zero,
        tax: zero,
        total: unit,
        stockStatus: "in_stock",
        purchasable: true,
        problems: [],
        ...(variationId ? { variationId } : {}),
      },
    ],
    subtotal: unit,
    discount: zero,
    tax: zero,
    total: unit,
    calculatedAt: "2026-09-13T20:00:00.000Z",
    expiresAt: "2026-09-13T21:00:00.000Z",
    purchasable: true,
  };
}

describe("STG-06 quote catalog identity translation", () => {
  test("translates POS item IDs to Woo source IDs and preserves cart fields", () => {
    const translated = translateQuoteRequestToProvider({
      request: REQUEST,
      requiredSourceSystem: "woocommerce",
      mappings: [mapping(POS_PRODUCT, "101")],
    });
    expect(translated.ok).toBe(true);
    if (!translated.ok) {
      return;
    }
    expect(translated.value.request.cartId).toBe(REQUEST.cartId);
    expect(translated.value.request.cartRevision).toBe(3);
    expect(translated.value.request.customer).toEqual({ kind: "walkin" });
    expect(translated.value.request.locationId).toBe("loc_a1");
    expect(translated.value.request.lines[0]?.lineId).toBe(LINE_ID);
    expect(translated.value.request.lines[0]?.quantity).toBe("2");
    expect(translated.value.request.lines[0]?.productId).toBe("101");
    expect(translated.value.request.lines[0]?.productId).not.toBe(POS_PRODUCT);
  });

  test("translates variation IDs together with the parent product", () => {
    const translated = translateQuoteRequestToProvider({
      request: VARIATION_REQUEST,
      requiredSourceSystem: "woocommerce",
      mappings: [mapping(POS_PRODUCT, "101"), mapping(POS_VARIATION, "202")],
    });
    expect(translated.ok).toBe(true);
    if (!translated.ok) {
      return;
    }
    expect(translated.value.request.lines[0]?.productId).toBe("101");
    expect(translated.value.request.lines[0]?.variationId).toBe("202");
    expect(translated.value.lines[0]?.posVariationId).toBe(POS_VARIATION);
  });

  test("missing mapping fails closed", () => {
    const translated = translateQuoteRequestToProvider({
      request: REQUEST,
      requiredSourceSystem: "woocommerce",
      mappings: [],
    });
    expect(translated.ok).toBe(false);
    if (!translated.ok) {
      expect(translated.message).toContain("missing");
    }
  });

  test("wrong source system fails closed", () => {
    const translated = translateQuoteRequestToProvider({
      request: REQUEST,
      requiredSourceSystem: "woocommerce",
      mappings: [mapping(POS_PRODUCT, "101", { sourceSystem: "shopify" })],
    });
    expect(translated.ok).toBe(false);
    if (!translated.ok) {
      expect(translated.message).toContain("WooCommerce");
    }
  });

  test("tombstoned mapping fails closed", () => {
    const translated = translateQuoteRequestToProvider({
      request: REQUEST,
      requiredSourceSystem: "woocommerce",
      mappings: [mapping(POS_PRODUCT, "101", { tombstoned: true })],
    });
    expect(translated.ok).toBe(false);
  });

  test("ambiguous mapping fails closed", () => {
    const translated = translateQuoteRequestToProvider({
      request: REQUEST,
      requiredSourceSystem: "woocommerce",
      mappings: [mapping(POS_PRODUCT, "101"), mapping(POS_PRODUCT, "999")],
    });
    expect(translated.ok).toBe(false);
    if (!translated.ok) {
      expect(translated.message).toContain("ambiguous");
    }
  });

  test("response IDs are restored to POS IDs without reading prices from the projection", () => {
    const translated = translateQuoteRequestToProvider({
      request: VARIATION_REQUEST,
      requiredSourceSystem: "woocommerce",
      mappings: [mapping(POS_PRODUCT, "101"), mapping(POS_VARIATION, "202")],
    });
    expect(translated.ok).toBe(true);
    if (!translated.ok) {
      return;
    }
    expect(JSON.stringify(translated.value.lines)).not.toContain("minor");
    expect(JSON.stringify(translated.value.lines)).not.toContain("display_price");
    const restored = restoreQuoteToPosIds({
      quote: quoteFrom(translated.value.request, "101", "202"),
      translation: translated.value,
    });
    expect(restored.ok).toBe(true);
    if (!restored.ok) {
      return;
    }
    expect(restored.value.lines[0]?.productId).toBe(POS_PRODUCT);
    expect(restored.value.lines[0]?.variationId).toBe(POS_VARIATION);
    expect(restored.value.total.minor).toBe(1500);
  });
});
