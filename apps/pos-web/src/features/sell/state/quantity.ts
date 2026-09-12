/**
 * UI-boundary decimal quantity strings. This is not a domain Quantity type.
 * Arithmetic uses integer digit scaling only — never floating-point.
 */

export type QuantityEditResult =
  | { readonly ok: true; readonly quantity: string }
  | { readonly ok: false; readonly message: string };

const QUANTITY_PATTERN = /^(0|[1-9]\d{0,8})(?:\.(\d{1,6}))?$/;

function parseParts(raw: string): { whole: string; frac: string } | null {
  const cleaned = raw.trim();
  const match = QUANTITY_PATTERN.exec(cleaned);
  if (!match) return null;
  return { whole: match[1] ?? "0", frac: match[2] ?? "" };
}

function formatQuantity(whole: string, frac: string): string {
  const trimmedFrac = frac.replace(/0+$/, "");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";
  if (!trimmedFrac) return normalizedWhole === "0" ? "" : normalizedWhole;
  return `${normalizedWhole}.${trimmedFrac}`;
}

export function addQuantity(left: string, right: string): QuantityEditResult {
  const a = parseParts(left);
  const b = parseParts(right);
  if (!a || !b) {
    return { ok: false, message: "Enter a valid quantity." };
  }
  const scale = Math.max(a.frac.length, b.frac.length);
  const aDigits = `${a.whole}${a.frac.padEnd(scale, "0")}`;
  const bDigits = `${b.whole}${b.frac.padEnd(scale, "0")}`;
  const sum = BigInt(aDigits) + BigInt(bDigits);
  if (sum <= BigInt(0)) {
    return { ok: false, message: "Quantity must be greater than zero." };
  }
  const raw = sum.toString().padStart(scale + 1, "0");
  const whole = scale === 0 ? raw : raw.slice(0, raw.length - scale);
  const frac = scale === 0 ? "" : raw.slice(raw.length - scale);
  const quantity = formatQuantity(whole, frac);
  if (!quantity) {
    return { ok: false, message: "Quantity must be greater than zero." };
  }
  return { ok: true, quantity };
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
  const scale = Math.max(a.frac.length, b.frac.length);
  const aDigits = `${a.whole}${a.frac.padEnd(scale, "0")}`;
  const bDigits = `${b.whole}${b.frac.padEnd(scale, "0")}`;
  const diff = BigInt(aDigits) - BigInt(bDigits);
  if (diff <= BigInt(0)) {
    return { ok: false, message: "Quantity must be greater than zero." };
  }
  const raw = diff.toString().padStart(scale + 1, "0");
  const whole = scale === 0 ? raw : raw.slice(0, raw.length - scale);
  const frac = scale === 0 ? "" : raw.slice(raw.length - scale);
  const next = formatQuantity(whole, frac);
  if (!next) {
    return { ok: false, message: "Quantity must be greater than zero." };
  }
  return { ok: true, quantity: next };
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
  return { ok: true, quantity };
}
