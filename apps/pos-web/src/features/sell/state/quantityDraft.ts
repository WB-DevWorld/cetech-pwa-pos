/**
 * Transient cashier quantity typing. Canonical cart state is committed only
 * on blur/Enter through parseQuantityInput — never on each keypress.
 */

import { parseQuantityInput } from "./quantity";

export type QuantityDraftCommit =
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "unchanged"; readonly quantity: string }
  | { readonly kind: "commit"; readonly quantity: string };

export function holdQuantityDraft(next: string): string {
  return next;
}

export function commitQuantityDraft(draft: string, canonical: string): QuantityDraftCommit {
  const parsed = parseQuantityInput(draft);
  if (!parsed.ok) {
    return { kind: "invalid", message: parsed.message };
  }
  if (parsed.quantity === canonical) {
    return { kind: "unchanged", quantity: parsed.quantity };
  }
  return { kind: "commit", quantity: parsed.quantity };
}

export function restoreQuantityDraft(canonical: string): string {
  return canonical;
}
