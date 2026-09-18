/**
 * FE-04 presentation view-models.
 * These are not production contracts. Discriminants match frozen v1 QuoteState /
 * CheckoutEligibility so cashiers see the same states; they are not PricingPort.
 */

import { describeQuoteFailure } from "../../../ui/cashier-language";

export type QuotePresentationMoney = {
  readonly minor: number;
  readonly currency: string;
};

export type QuotePresentationLine = {
  readonly lineId: string;
  readonly unitPrice: QuotePresentationMoney;
  readonly total: QuotePresentationMoney;
};

export type QuotePresentationSnapshot = {
  readonly total: QuotePresentationMoney;
  readonly subtotal?: QuotePresentationMoney;
  readonly discount?: QuotePresentationMoney;
  readonly tax?: QuotePresentationMoney;
  readonly lines?: readonly QuotePresentationLine[];
};

/** Failed-quote presentation codes match frozen ApiErrorCode. QuoteProblem-only codes are excluded. */
export const FAILED_QUOTE_CODES = [
  "VALIDATION_ERROR",
  "AUTH_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "QUOTE_CHANGED",
  "QUOTE_EXPIRED",
  "STOCK_CHANGED",
  "SHIFT_REQUIRED",
  "SHIFT_CONFLICT",
  "PAYMENT_PENDING",
  "PAYMENT_NOT_VERIFIED",
  "INTEGRATION_UNAVAILABLE",
  "IDEMPOTENCY_CONFLICT",
  "OPERATION_IN_PROGRESS",
  "REQUIRES_ATTENTION",
  "RATE_LIMITED",
  "UNSUPPORTED_VERSION",
] as const;

export type FailedQuoteCodeView = (typeof FAILED_QUOTE_CODES)[number];

export type QuoteDisplayState =
  | { readonly status: "missing" }
  | { readonly status: "stale" }
  | { readonly status: "expired" }
  | { readonly status: "offline" }
  | { readonly status: "quoting"; readonly revision: number }
  | { readonly status: "confirmed"; readonly revision: number; readonly quote: QuotePresentationSnapshot }
  | {
      readonly status: "changed";
      readonly revision: number;
      readonly previous: QuotePresentationSnapshot;
      readonly current: QuotePresentationSnapshot;
    }
  | { readonly status: "failed"; readonly revision: number; readonly code: FailedQuoteCodeView; readonly message: string };

export const CHECKOUT_ELIGIBILITY_REASONS = [
  "NO_ACTIVE_SHIFT",
  "CART_EMPTY",
  "QUOTE_REQUIRED",
  "QUOTE_STALE",
  "QUOTE_EXPIRED",
  "CONNECTION_REQUIRED",
  "PRODUCT_UNAVAILABLE",
  "CRITICAL_RECOVERY_PENDING",
  "PASSIVE_WINDOW",
  "UNSUPPORTED_APP_VERSION",
] as const;

export type CheckoutEligibilityReasonView = (typeof CHECKOUT_ELIGIBILITY_REASONS)[number];

export type CheckoutEligibilityView =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: CheckoutEligibilityReasonView; readonly message: string };

export type QuoteAmountRow = {
  readonly label: string;
  readonly value: string;
  readonly emphasize?: boolean;
};

export type QuoteStatusView = {
  readonly tone: "muted" | "quoting" | "stale" | "expired" | "offline" | "confirmed" | "changed" | "failed";
  readonly message: string;
  readonly amounts?: readonly QuoteAmountRow[];
  readonly comparison?: { readonly previousLabel: string; readonly previous: string; readonly currentLabel: string; readonly current: string };
  readonly code?: string;
  readonly technicalMessage?: string;
};

export type PayButtonView = {
  readonly disabled: boolean;
  readonly label: string;
  readonly reason: string;
  readonly eligibilityAllowed: boolean;
  readonly eligibilityReason?: CheckoutEligibilityReasonView;
};

export type PayButtonOptions = {
  readonly checkoutReady?: boolean;
  readonly inFlight?: boolean;
  readonly confirmedTotal?: QuotePresentationMoney;
};

export type QuoteDisplayOptions = {
  readonly cartLineNames?: readonly string[];
};

export const INTEGRATION_UNAVAILABLE: FailedQuoteCodeView = "INTEGRATION_UNAVAILABLE";

const LIVE_PAYMENT_BLOCKED_REASON = "Review the price, then continue when payment is available.";
const CHECKOUT_IN_PROGRESS_REASON = "Checkout is in progress.";
const PRICE_NOT_READY_REASON = "Checkout is unavailable until the price is ready.";

export function isCheckoutEligibilityReason(value: string): value is CheckoutEligibilityReasonView {
  return (CHECKOUT_ELIGIBILITY_REASONS as readonly string[]).includes(value);
}

export function isFailedQuoteCode(value: string): value is FailedQuoteCodeView {
  return (FAILED_QUOTE_CODES as readonly string[]).includes(value);
}

/** Display formatting of a supplied Money snapshot. Does not compute commercial totals. */
export function formatMoneyDisplay(money: QuotePresentationMoney): string {
  const minor = money.minor;
  if (!Number.isInteger(minor) || minor < 0) {
    return money.currency;
  }
  const whole = Math.trunc(minor / 100);
  const frac = minor - whole * 100;
  const fracText = frac < 10 ? `0${frac}` : String(frac);
  return `${money.currency} ${whole}.${fracText}`;
}

function snapshotAmountRows(snapshot: QuotePresentationSnapshot): QuoteAmountRow[] {
  const rows: QuoteAmountRow[] = [];
  if (snapshot.subtotal) rows.push({ label: "Subtotal", value: formatMoneyDisplay(snapshot.subtotal) });
  if (snapshot.discount && snapshot.discount.minor !== 0) {
    rows.push({ label: "Discount", value: formatMoneyDisplay(snapshot.discount) });
  }
  if (snapshot.tax) rows.push({ label: "Tax", value: formatMoneyDisplay(snapshot.tax) });
  rows.push({ label: "Total", value: formatMoneyDisplay(snapshot.total), emphasize: true });
  return rows;
}

export function describeQuoteDisplay(quote: QuoteDisplayState, options?: QuoteDisplayOptions): QuoteStatusView {
  switch (quote.status) {
    case "missing":
      return { tone: "muted", message: "Prices will be ready after an item is added." };
    case "quoting":
      return { tone: "quoting", message: "Updating price…" };
    case "stale":
      return {
        tone: "stale",
        message: "Price needs to be checked again.",
      };
    case "expired":
      return { tone: "expired", message: "Price needs to be checked again." };
    case "offline":
      return {
        tone: "offline",
        message: "A connection is required to check prices and take payment. You can keep browsing and editing the cart.",
      };
    case "confirmed":
      return {
        tone: "confirmed",
        message: "Price ready",
        amounts: snapshotAmountRows(quote.quote),
      };
    case "changed":
      return {
        tone: "changed",
        message: "Price changed. Review the old and new total before continuing.",
        comparison: {
          previousLabel: "Previous total",
          previous: formatMoneyDisplay(quote.previous.total),
          currentLabel: "New total",
          current: formatMoneyDisplay(quote.current.total),
        },
      };
    case "failed": {
      const mapped = describeQuoteFailure({
        code: quote.code,
        message: quote.message,
        cartLineNames: options?.cartLineNames,
      });
      return {
        tone: "failed",
        message: mapped.message,
        code: quote.code,
        technicalMessage: quote.message,
      };
    }
  }
}

/**
 * Eligibility is rendered, not decided here. Pay stays disabled unless an
 * authoritative eligible quote and injected checkout runtime are both present.
 */
export function describePayButton(
  eligibility: CheckoutEligibilityView | undefined,
  options?: PayButtonOptions,
): PayButtonView {
  const label = options?.confirmedTotal ? `Pay ${formatMoneyDisplay(options.confirmedTotal)}` : "Pay";
  if (!eligibility) {
    return {
      disabled: true,
      label,
      reason: PRICE_NOT_READY_REASON,
      eligibilityAllowed: false,
    };
  }
  if (!eligibility.allowed) {
    return {
      disabled: true,
      label,
      reason: eligibility.message,
      eligibilityAllowed: false,
      eligibilityReason: eligibility.reason,
    };
  }
  if (!options?.checkoutReady) {
    return {
      disabled: true,
      label,
      reason: LIVE_PAYMENT_BLOCKED_REASON,
      eligibilityAllowed: true,
    };
  }
  if (options.inFlight) {
    return {
      disabled: true,
      label,
      reason: CHECKOUT_IN_PROGRESS_REASON,
      eligibilityAllowed: true,
    };
  }
  return {
    disabled: false,
    label,
    reason: "",
    eligibilityAllowed: true,
  };
}
