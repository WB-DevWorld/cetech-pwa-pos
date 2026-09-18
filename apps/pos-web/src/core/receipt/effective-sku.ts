import type { CatalogPresentationItem } from "./catalog-presentation";

function normalizeSku(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Frozen receipt SKU for one sale line.
 * Variation SKU wins; otherwise parent SKU; simple products use their own SKU.
 * Missing SKU is omitted by the caller. `showSku=false` yields undefined.
 */
export function resolveEffectiveSku(input: {
  readonly selected: CatalogPresentationItem;
  readonly parent?: CatalogPresentationItem;
  readonly showSku: boolean;
}): string | undefined {
  if (!input.showSku) {
    return undefined;
  }
  const own = normalizeSku(input.selected.sku);
  if (own) {
    return own;
  }
  if (input.selected.kind === "variation" || input.parent) {
    return normalizeSku(input.parent?.sku);
  }
  return undefined;
}
