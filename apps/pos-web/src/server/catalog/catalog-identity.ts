import type { Quote, QuoteRequest, QuoteRequestLine } from "../../../../../docs/contracts/domain.generated";

export const REQUIRED_QUOTE_SOURCE_SYSTEM = "woocommerce";

/** Identity-only projection fields. Prices are never part of quote mapping. */
export type CatalogIdentityMapping = {
  readonly itemId: string;
  readonly sourceSystem: string;
  readonly sourceItemId: string;
  readonly tombstoned: boolean;
};

export type QuoteLineIdentity = {
  readonly lineId: string;
  readonly posProductId: string;
  readonly posVariationId?: string;
  readonly providerProductId: string;
  readonly providerVariationId?: string;
};

export type QuoteIdentityTranslation = {
  readonly request: QuoteRequest;
  readonly lines: ReadonlyArray<QuoteLineIdentity>;
};

export type QuoteIdentityResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

export function indexCatalogIdentity(
  mappings: ReadonlyArray<CatalogIdentityMapping>,
): Map<string, CatalogIdentityMapping[]> {
  const byItemId = new Map<string, CatalogIdentityMapping[]>();
  for (const mapping of mappings) {
    const existing = byItemId.get(mapping.itemId);
    if (existing) {
      existing.push(mapping);
    } else {
      byItemId.set(mapping.itemId, [mapping]);
    }
  }
  return byItemId;
}

export function collectQuoteIdentityItemIds(request: QuoteRequest): readonly string[] {
  const ids = new Set<string>();
  for (const line of request.lines) {
    ids.add(line.productId);
    if (line.variationId) {
      ids.add(line.variationId);
    }
  }
  return [...ids];
}

export function translateQuoteRequestToProvider(input: {
  readonly request: QuoteRequest;
  readonly requiredSourceSystem: typeof REQUIRED_QUOTE_SOURCE_SYSTEM;
  readonly mappings: ReadonlyArray<CatalogIdentityMapping>;
}): QuoteIdentityResult<QuoteIdentityTranslation> {
  const byItemId = indexCatalogIdentity(input.mappings);
  const lines: QuoteLineIdentity[] = [];
  const providerLines: QuoteRequestLine[] = [];
  for (const line of input.request.lines) {
    const product = resolveItemIdentity(line.productId, input.requiredSourceSystem, byItemId);
    if (!product.ok) {
      return product;
    }
    let variation: QuoteIdentityResult<CatalogIdentityMapping> | undefined;
    if (line.variationId) {
      variation = resolveItemIdentity(line.variationId, input.requiredSourceSystem, byItemId);
      if (!variation.ok) {
        return variation;
      }
    }
    const identity: QuoteLineIdentity = {
      lineId: line.lineId,
      posProductId: line.productId,
      providerProductId: product.value.sourceItemId,
      ...(line.variationId && variation && variation.ok
        ? { posVariationId: line.variationId, providerVariationId: variation.value.sourceItemId }
        : {}),
    };
    lines.push(identity);
    providerLines.push({
      lineId: line.lineId,
      productId: identity.providerProductId,
      quantity: line.quantity,
      ...(identity.providerVariationId ? { variationId: identity.providerVariationId } : {}),
    });
  }
  return {
    ok: true,
    value: {
      request: {
        cartId: input.request.cartId,
        cartRevision: input.request.cartRevision,
        customer: input.request.customer,
        locationId: input.request.locationId,
        lines: providerLines,
      },
      lines,
    },
  };
}

export function restoreQuoteToPosIds(input: {
  readonly quote: Quote;
  readonly translation: QuoteIdentityTranslation;
}): QuoteIdentityResult<Quote> {
  if (!input.quote || !Array.isArray(input.quote.lines)) {
    return { ok: false, message: "quote identity mapping could not restore provider-neutral line ids" };
  }
  const byLineId = new Map(input.translation.lines.map((line) => [line.lineId, line]));
  if (input.quote.lines.length !== input.translation.lines.length) {
    return { ok: false, message: "quote identity mapping could not restore provider-neutral line ids" };
  }
  const lines = [];
  for (const line of input.quote.lines) {
    const identity = byLineId.get(line.lineId);
    if (!identity) {
      return { ok: false, message: "quote identity mapping could not restore provider-neutral line ids" };
    }
    lines.push({
      ...line,
      productId: identity.posProductId,
      ...(identity.posVariationId ? { variationId: identity.posVariationId } : {}),
    });
  }
  return {
    ok: true,
    value: {
      ...input.quote,
      lines,
    },
  };
}

function resolveItemIdentity(
  itemId: string,
  requiredSourceSystem: string,
  byItemId: ReadonlyMap<string, readonly CatalogIdentityMapping[]>,
): QuoteIdentityResult<CatalogIdentityMapping> {
  const rows = byItemId.get(itemId) ?? [];
  if (rows.length === 0) {
    return { ok: false, message: "catalog identity mapping is missing for a quote line" };
  }
  if (rows.length > 1) {
    return { ok: false, message: "catalog identity mapping is ambiguous for a quote line" };
  }
  const mapping = rows[0];
  if (!mapping) {
    return { ok: false, message: "catalog identity mapping is missing for a quote line" };
  }
  if (mapping.tombstoned) {
    return { ok: false, message: "catalog identity mapping is unavailable for a quote line" };
  }
  if (mapping.sourceSystem !== requiredSourceSystem) {
    return { ok: false, message: "catalog identity mapping is not a WooCommerce source for the current quote adapter" };
  }
  if (!mapping.sourceItemId) {
    return { ok: false, message: "catalog identity mapping is missing for a quote line" };
  }
  return { ok: true, value: mapping };
}
