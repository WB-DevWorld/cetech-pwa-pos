/**
 * UI-boundary conversion of a cashier-entered decimal amount into nonnegative
 * integer minor units. This is not a domain Money type and does not assert currency.
 */
export type DecimalParseResult =
  | { readonly ok: true; readonly minor: number }
  | { readonly ok: false; readonly message: string };

const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{0,2}))?$/;

export function parseDecimalToMinorUnits(raw: string): DecimalParseResult {
  const cleaned = raw.trim();
  if (!cleaned) {
    return { ok: false, message: "Enter an opening amount." };
  }
  const match = DECIMAL_PATTERN.exec(cleaned);
  if (!match) {
    return { ok: false, message: "Enter a valid amount using digits only." };
  }
  const whole = match[1] ?? "0";
  const fraction = (match[2] ?? "").padEnd(2, "0").slice(0, 2);
  const digits = `${whole}${fraction}`;
  if (digits.length > 15) {
    return { ok: false, message: "Amount is too large." };
  }
  const minor = Number.parseInt(digits, 10);
  if (!Number.isSafeInteger(minor) || minor < 0) {
    return { ok: false, message: "Enter a valid amount using digits only." };
  }
  return { ok: true, minor };
}
