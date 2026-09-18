import type { Quote, QuoteLine, ReceiptLine, ReceiptSettings } from "../../../../../docs/contracts/domain.generated";
import type { CatalogPresentationItem, CatalogPresentationLookup } from "./catalog-presentation";
import { formatReceiptDisplayName } from "./display-name";
import { resolveEffectiveSku } from "./effective-sku";

export type ReceiptLineBuildFailure = {
  readonly ok: false;
  readonly lineId: QuoteLine["lineId"];
  readonly message: string;
};

function presentationLabel(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveSoldCatalogItem(input: {
  readonly line: QuoteLine;
  readonly items: ReadonlyMap<string, CatalogPresentationItem>;
}):
  | { readonly ok: true; readonly selected: CatalogPresentationItem; readonly parent?: CatalogPresentationItem }
  | { readonly ok: false; readonly message: string } {
  if (input.line.variationId) {
    const selected = input.items.get(input.line.variationId);
    if (!selected) {
      return { ok: false, message: "sale-time variation presentation is unavailable for the receipt snapshot" };
    }
    const parent = input.items.get(input.line.productId);
    return parent ? { ok: true, selected, parent } : { ok: true, selected };
  }
  const selected = input.items.get(input.line.productId);
  if (!selected) {
    return { ok: false, message: "sale-time product presentation is unavailable for the receipt snapshot" };
  }
  return { ok: true, selected };
}

/** Capture full sale-time presentation. Does not shorten names or apply receipt print settings. */
export function captureSalePresentationLine(input: {
  readonly line: QuoteLine;
  readonly selected: CatalogPresentationItem;
  readonly parent?: CatalogPresentationItem;
}): ReceiptLine {
  const name = input.selected.name;
  const sku = resolveEffectiveSku({
    selected: input.selected,
    parent: input.parent,
  });
  const variationLabel = input.selected.kind === "variation" ? presentationLabel(input.selected.variationLabel) : undefined;
  return {
    name,
    ...(sku ? { sku } : {}),
    ...(variationLabel ? { variationLabel } : {}),
    quantity: input.line.quantity,
    unitPrice: input.line.unitPrice,
    subtotal: input.line.subtotal,
    discount: input.line.discount,
    tax: input.line.tax,
    total: input.line.total,
  };
}

/** Receipt-only freeze. Shortening and showSku apply here, never at prepare or reprint. */
export function freezeReceiptLine(line: ReceiptLine, settings: ReceiptSettings): ReceiptLine {
  const displayName = formatReceiptDisplayName(line.name, settings);
  const sku = settings.showSku ? line.sku : undefined;
  return {
    name: line.name,
    displayName,
    ...(sku ? { sku } : {}),
    ...(line.variationLabel ? { variationLabel: line.variationLabel } : {}),
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    subtotal: line.subtotal,
    discount: line.discount,
    tax: line.tax,
    total: line.total,
  };
}

export function freezeReceiptLines(
  lines: readonly ReceiptLine[],
  settings: ReceiptSettings,
): readonly ReceiptLine[] {
  return lines.map((line) => freezeReceiptLine(line, settings));
}

export function captureSalePresentationLines(input: {
  readonly quote: Quote;
  readonly items: ReadonlyMap<string, CatalogPresentationItem>;
}): { readonly ok: true; readonly lines: readonly ReceiptLine[] } | ReceiptLineBuildFailure {
  const lines: ReceiptLine[] = [];
  for (const line of input.quote.lines) {
    const resolved = resolveSoldCatalogItem({ line, items: input.items });
    if (!resolved.ok) {
      return { ok: false, lineId: line.lineId, message: resolved.message };
    }
    lines.push(
      captureSalePresentationLine({
        line,
        selected: resolved.selected,
        parent: resolved.parent,
      }),
    );
  }
  return { ok: true, lines };
}

export function catalogIdsForQuote(quote: Quote): readonly string[] {
  const ids = new Set<string>();
  for (const line of quote.lines) {
    ids.add(line.productId);
    if (line.variationId) {
      ids.add(line.variationId);
    }
  }
  return [...ids];
}

/**
 * Load and validate sale-time presentation before a first commercial prepare,
 * and again on lost-response recovery. Does not shorten names or apply showSku.
 */
export async function loadSalePresentation(input: {
  readonly catalogLookup: CatalogPresentationLookup;
  readonly organizationId: string;
  readonly quote: Quote;
}): Promise<{ readonly ok: true; readonly lines: readonly ReceiptLine[] } | ReceiptLineBuildFailure> {
  const items = await input.catalogLookup.getItems(input.organizationId, catalogIdsForQuote(input.quote));
  return captureSalePresentationLines({ quote: input.quote, items });
}
