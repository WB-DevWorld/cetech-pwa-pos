import type { ReceiptSettings } from "../../../../../docs/contracts/domain.generated";

export const RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_MIN = 1;
export const RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_MAX = 256;
export const RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_DEFAULT = 40;

/** Backward-compatible operational defaults. Shortening and SKU printing are off. */
export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  shortenProductNames: false,
  productNameMaxCharacters: RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_DEFAULT,
  showSku: false,
};

export function isReceiptSettings(value: unknown): value is ReceiptSettings {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.shortenProductNames !== "boolean" || typeof record.showSku !== "boolean") {
    return false;
  }
  if (typeof record.productNameMaxCharacters !== "number" || !Number.isInteger(record.productNameMaxCharacters)) {
    return false;
  }
  if (
    record.productNameMaxCharacters < RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_MIN ||
    record.productNameMaxCharacters > RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_MAX
  ) {
    return false;
  }
  return Object.keys(record).every(
    (key) => key === "shortenProductNames" || key === "productNameMaxCharacters" || key === "showSku",
  );
}

export function receiptSettingsFromUnknown(value: unknown): ReceiptSettings | undefined {
  return isReceiptSettings(value) ? value : undefined;
}
