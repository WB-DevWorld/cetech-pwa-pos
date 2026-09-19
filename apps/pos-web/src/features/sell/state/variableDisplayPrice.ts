export type AdvisoryMoneyView = {
  readonly minor: number;
  readonly currency: string;
};

export type ProductDisplayPriceView =
  | { readonly kind: "single"; readonly amount: AdvisoryMoneyView }
  | { readonly kind: "range"; readonly min: AdvisoryMoneyView; readonly max: AdvisoryMoneyView }
  | { readonly kind: "unavailable" };

export type AdvisoryPricedChild = {
  readonly displayPrice?: AdvisoryMoneyView;
};

function isUsableMoney(value: AdvisoryMoneyView | undefined): value is AdvisoryMoneyView {
  return Boolean(value && Number.isInteger(value.minor) && value.minor >= 0 && value.currency);
}

/**
 * Provider-neutral advisory presentation only. Never a quote, B2B, or checkout price.
 * Child set must be the same CatalogPort parentId family used by variation discovery.
 */
export function deriveVariableDisplayPrice(
  parent: { readonly displayPrice?: AdvisoryMoneyView },
  children: { readonly ok: false } | { readonly ok: true; readonly items: readonly AdvisoryPricedChild[] },
): ProductDisplayPriceView {
  if (isUsableMoney(parent.displayPrice)) {
    return { kind: "single", amount: parent.displayPrice };
  }
  if (!children.ok) {
    return { kind: "unavailable" };
  }
  if (children.items.length === 0) {
    return { kind: "unavailable" };
  }
  const priced: AdvisoryMoneyView[] = [];
  for (const child of children.items) {
    if (!isUsableMoney(child.displayPrice)) {
      return { kind: "unavailable" };
    }
    priced.push(child.displayPrice);
  }
  const currency = priced[0]?.currency;
  if (!currency || priced.some((price) => price.currency !== currency)) {
    return { kind: "unavailable" };
  }
  let min = priced[0]!;
  let max = priced[0]!;
  for (const price of priced) {
    if (price.minor < min.minor) min = price;
    if (price.minor > max.minor) max = price;
  }
  if (min.minor === max.minor) {
    return { kind: "single", amount: min };
  }
  return { kind: "range", min, max };
}

export function formatProductDisplayPrice(
  view: ProductDisplayPriceView | undefined,
  formatMoney: (money: AdvisoryMoneyView) => string,
  options?: { readonly treatMissingAsUnavailable?: boolean },
): string | null {
  if (!view) {
    return options?.treatMissingAsUnavailable ? "Price unavailable" : null;
  }
  if (view.kind === "unavailable") {
    return "Price unavailable";
  }
  if (view.kind === "single") {
    return formatMoney(view.amount);
  }
  return `${formatMoney(view.min)} – ${formatMoney(view.max)}`;
}
