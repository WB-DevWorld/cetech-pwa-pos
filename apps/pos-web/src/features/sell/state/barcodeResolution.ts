import type { SellProductView } from "./sellView";

export type BarcodeResolution =
  | { readonly kind: "empty" }
  | { readonly kind: "unknown"; readonly barcode: string }
  | { readonly kind: "collision"; readonly barcode: string; readonly matches: readonly SellProductView[] }
  | { readonly kind: "add"; readonly barcode: string; readonly item: SellProductView }
  | { readonly kind: "chooser"; readonly barcode: string; readonly product: SellProductView };

function exactBarcodeMatches(items: readonly SellProductView[], barcode: string): SellProductView[] {
  return items.filter((item) => item.barcodes.some((value) => value === barcode));
}

/** Digit-only search-field contents may be treated as a typed barcode. Never coerced through Number. */
export function isDigitBarcodeQuery(query: string): boolean {
  const exact = query.trim();
  return exact.length > 0 && /^\d+$/.test(exact);
}

/** Resolve a cashier barcode against a presentation catalog snapshot. The barcode remains a string. */
export function resolveBarcode(barcode: string, items: readonly SellProductView[]): BarcodeResolution {
  const exact = barcode;
  if (exact.length === 0) return { kind: "empty" };
  const matches = exactBarcodeMatches(items, exact);
  if (matches.length === 0) {
    return { kind: "unknown", barcode: exact };
  }
  if (matches.length > 1) {
    return { kind: "collision", barcode: exact, matches };
  }
  const item = matches[0];
  if (!item) {
    return { kind: "unknown", barcode: exact };
  }
  if (item.kind === "variable") {
    return { kind: "chooser", barcode: exact, product: item };
  }
  return { kind: "add", barcode: exact, item };
}

export function childrenOf(parentId: string, items: readonly SellProductView[]): SellProductView[] {
  return items.filter((item) => item.kind === "variation" && item.parentId === parentId);
}
