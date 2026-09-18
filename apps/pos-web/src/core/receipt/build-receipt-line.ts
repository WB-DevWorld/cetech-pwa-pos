import type { Quote, QuoteLine, ReceiptLine, ReceiptSettings } from "../../../../../docs/contracts/domain.generated";
import type { CatalogPresentationItem } from "./catalog-presentation";
import { formatReceiptDisplayName } from "./display-name";
import { resolveEffectiveSku } from "./effective-sku";

export type ReceiptLineBuildFailure = {
  readonly ok: false;
  readonly lineId: QuoteLine["lineId"];
  readonly message: string;
};

export type ReceiptLineBuildSuccess = {
  readonly ok: true;
  readonly line: ReceiptLine;
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

export function buildReceiptLine(input: {
  readonly line: QuoteLine;
  readonly selected: CatalogPresentationItem;
  readonly parent?: CatalogPresentationItem;
  readonly settings: ReceiptSettings;
}): ReceiptLine {
  const name = input.selected.name;
  const displayName = formatReceiptDisplayName(name, input.settings);
  const sku = resolveEffectiveSku({
    selected: input.selected,
    parent: input.parent,
    showSku: input.settings.showSku,
  });
  const variationLabel = input.selected.kind === "variation" ? presentationLabel(input.selected.variationLabel) : undefined;
  return {
    name,
    displayName,
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

export function receiptLinesFromQuotePresentation(input: {
  readonly quote: Quote;
  readonly items: ReadonlyMap<string, CatalogPresentationItem>;
  readonly settings: ReceiptSettings;
}): { readonly ok: true; readonly lines: readonly ReceiptLine[] } | ReceiptLineBuildFailure {
  const lines: ReceiptLine[] = [];
  for (const line of input.quote.lines) {
    const resolved = resolveSoldCatalogItem({ line, items: input.items });
    if (!resolved.ok) {
      return { ok: false, lineId: line.lineId, message: resolved.message };
    }
    lines.push(
      buildReceiptLine({
        line,
        selected: resolved.selected,
        parent: resolved.parent,
        settings: input.settings,
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
