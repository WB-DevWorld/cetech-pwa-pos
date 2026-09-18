import type { ReceiptSettings } from "../../../../../docs/contracts/domain.generated";

/** Receipt-only Unicode ellipsis. Do not reuse to mutate catalog or search text. */
export const RECEIPT_DISPLAY_NAME_ELLIPSIS = "\u2026";

function codePoints(value: string): readonly string[] {
  return Array.from(value);
}

/**
 * Build the frozen printable product name for a receipt snapshot.
 * Never mutates `fullName`. Not a catalog/search/cart truncation helper.
 */
export function formatReceiptDisplayName(fullName: string, settings: ReceiptSettings): string {
  if (!settings.shortenProductNames) {
    return fullName;
  }
  const characters = codePoints(fullName);
  if (characters.length <= settings.productNameMaxCharacters) {
    return fullName;
  }
  if (settings.productNameMaxCharacters <= 1) {
    return RECEIPT_DISPLAY_NAME_ELLIPSIS;
  }
  return `${characters.slice(0, settings.productNameMaxCharacters - 1).join("")}${RECEIPT_DISPLAY_NAME_ELLIPSIS}`;
}
