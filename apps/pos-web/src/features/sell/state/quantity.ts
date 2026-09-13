/**
 * UI-boundary decimal quantity strings. This is not a domain Quantity type.
 * Arithmetic uses integer digit scaling only — never floating-point.
 * After normalize, the result must still satisfy frozen v1 Quantity:
 * positive canonical decimal, max nine integer and six fractional digits,
 * no leading/trailing zero padding, no scientific notation.
 */

export type QuantityEditResult =
  | { readonly ok: true; readonly quantity: string }
  | { readonly ok: false; readonly message: string };

const INPUT_QUANTITY_PATTERN = /^(0|[1-9]\d{0,8})(?:\.(\d{1,6}))?$/;
/** Same constraints as frozen v1 Quantity after normalize. Do not import contract types. */
const CANONICAL_QUANTITY = /^(0\.[0-9]{0,5}[1-9]|[1-9][0-9]{0,8}(\.[0-9]{0,5}[1-9])?)$/;

function parseParts(raw: string): { whole: string; frac: string } | null {
  const cleaned = raw.trim();
  const match = INPUT_QUANTITY_PATTERN.exec(cleaned);
  if (!match) return null;
  return { whole: match[1] ?? "0", frac: match[2] ?? "" };
}

function formatQuantity(whole: string, frac: string): string {
  const trimmedFrac = frac.replace(/0+$/, "");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  if (!trimmedFrac) return normalizedWhole === "0" ? "" : normalizedWhole;
  return `${normalizedWhole}.${trimmedFrac}`;
}

function asCanonicalQuantity(quantity: string): QuantityEditResult {
  if (!CANONICAL_QUANTITY.test(quantity)) {
    return { ok: false, message: "Enter a valid quantity." };
  }
  return { ok: true, quantity };
}

function combineScaled(
  left: { whole: string; frac: string },
  right: { whole: string; frac: string },
  sign: bigint,
): QuantityEditResult {
  const scale = Math.max(left.frac.length, right.frac.length);
  const aDigits = `${left.whole}${left.frac.padEnd(scale, "0")}`;
  const bDigits = `${right.whole}${right.frac.padEnd(scale, "0")}`;
  const total = BigInt(aDigits) + sign * BigInt(bDigits);
  if (total <= BigInt(0)) {
    return { ok: false, message: "Quantity must be greater than zero." };
  }
  const raw = total.toString().padStart(scale + 1, "0");
  const whole = scale === 0 ? raw : raw.slice(0, raw.length - scale);
  const frac = scale === 0 ? "" : raw.slice(raw.length - scale);
  const quantity = formatQuantity(whole, frac);
  if (!quantity) {
    return { ok: false, message: "Quantity must be greater than zero." };
  }
  return asCanonicalQuantity(quantity);
}

export function addQuantity(left: string, right: string): QuantityEditResult {
  const a = parseParts(left);
  const b = parseParts(right);
  if (!a || !b) {
    return { ok: false, message: "Enter a valid quantity." };
  }
  return combineScaled(a, b, BigInt(1));
}

export function incrementQuantity(quantity: string): QuantityEditResult {
  return addQuantity(quantity, "1");
}

export function decrementQuantity(quantity: string): QuantityEditResult {
  const a = parseParts(quantity);
  const b = parseParts("1");
  if (!a || !b) {
    return { ok: false, message: "Enter a valid quantity." };
  }
  return combineScaled(a, b, BigInt(-1));
}

export function parseQuantityInput(raw: string): QuantityEditResult {
  const cleaned = raw.trim();
  if (!cleaned) {
    return { ok: false, message: "Enter a quantity." };
  }
  if (cleaned.startsWith("-")) {
    return { ok: false, message: "Quantity must be greater than zero." };
  }
  const parts = parseParts(cleaned);
  if (!parts) {
    return { ok: false, message: "Enter a valid quantity." };
  }
  const quantity = formatQuantity(parts.whole, parts.frac);
  if (!quantity || quantity === "0") {
    return { ok: false, message: "Quantity must be greater than zero." };
  }
  return asCanonicalQuantity(quantity);
}
