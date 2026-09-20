import type { CatalogPresentationItem } from "./catalog-presentation";

function normalizeSku(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Sale-time effective SKU for one line.
 * Variation SKU wins; otherwise parent SKU; simple products use their own SKU.
 * Receipt print omission (`showSku=false`) is applied later by freezeReceiptLine.
 */
export function resolveEffectiveSku(input: {
  readonly selected: CatalogPresentationItem;
  readonly parent?: CatalogPresentationItem;
}): string | undefined {
  const own = normalizeSku(input.selected.sku);
  if (own) {
    return own;
  }
  if (input.selected.kind === "variation" || input.parent) {
    return normalizeSku(input.parent?.sku);
  }
  return undefined;
}
