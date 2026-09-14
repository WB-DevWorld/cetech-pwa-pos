/**
 * FE-04 PREP_ONLY presentation view-models.
 * These are not production contracts. Discriminants match frozen v1 QuoteState /
 * CheckoutEligibility so cashiers see the same states; they are not PricingPort.
 */

export type QuotePresentationMoney = {
  readonly minor: number;
  readonly currency: string;
};

export type QuotePresentationSnapshot = {
  readonly total: QuotePresentationMoney;
  readonly subtotal?: QuotePresentationMoney;
  readonly discount?: QuotePresentationMoney;
  readonly tax?: QuotePresentationMoney;
};

/** PREP_ONLY failed-quote code. Not the canonical ApiErrorCode union; QuoteProblem-only codes are excluded. */
export type FailedQuoteCodeView = "INTEGRATION_UNAVAILABLE";

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

export type QuoteStatusView = {
  readonly tone: "muted" | "quoting" | "stale" | "expired" | "offline" | "confirmed" | "changed" | "failed";
  readonly message: string;
  readonly amounts?: readonly { readonly label: string; readonly value: string }[];
  readonly comparison?: { readonly previousLabel: string; readonly previous: string; readonly currentLabel: string; readonly current: string };
  readonly code?: string;
};

export type PayButtonView = {
  readonly disabled: boolean;
  readonly reason: string;
  readonly eligibilityAllowed: boolean;
  readonly eligibilityReason?: CheckoutEligibilityReasonView;
};

export type PayButtonOptions = {
  readonly checkoutReady?: boolean;
  readonly inFlight?: boolean;
};

export const INTEGRATION_UNAVAILABLE: FailedQuoteCodeView = "INTEGRATION_UNAVAILABLE";

const LIVE_PAYMENT_BLOCKED_REASON = "Review confirmed prices. Payment is not available on this screen.";
const CHECKOUT_IN_PROGRESS_REASON = "Checkout is in progress.";

export function isCheckoutEligibilityReason(value: string): value is CheckoutEligibilityReasonView {
  return (CHECKOUT_ELIGIBILITY_REASONS as readonly string[]).includes(value);
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

function snapshotAmountRows(snapshot: QuotePresentationSnapshot): { readonly label: string; readonly value: string }[] {
  const rows: { label: string; value: string }[] = [{ label: "Quoted total", value: formatMoneyDisplay(snapshot.total) }];
  if (snapshot.subtotal) rows.push({ label: "Quoted subtotal", value: formatMoneyDisplay(snapshot.subtotal) });
  if (snapshot.discount) rows.push({ label: "Quoted discount", value: formatMoneyDisplay(snapshot.discount) });
  if (snapshot.tax) rows.push({ label: "Quoted tax", value: formatMoneyDisplay(snapshot.tax) });
  return rows;
}

export function describeQuoteDisplay(quote: QuoteDisplayState): QuoteStatusView {
  switch (quote.status) {
    case "missing":
      return { tone: "muted", message: "Prices will be confirmed after an item is added." };
    case "quoting":
      return { tone: "quoting", message: "Updating price…" };
    case "stale":
      return {
        tone: "stale",
        message: "Current pricing is no longer current. Refresh is required before payment.",
      };
    case "expired":
      return { tone: "expired", message: "Price expired" };
    case "offline":
      return {
        tone: "offline",
        message: "Connection is required for authoritative pricing and checkout. You can keep browsing and editing the cart.",
      };
    case "confirmed":
      return {
        tone: "confirmed",
        message: "Price confirmed",
        amounts: snapshotAmountRows(quote.quote),
      };
    case "changed":
      return {
        tone: "changed",
        message: "Price changed. Review the previous and current quoted totals before continuing.",
        comparison: {
          previousLabel: "Previous quoted total",
          previous: formatMoneyDisplay(quote.previous.total),
          currentLabel: "Current quoted total",
          current: formatMoneyDisplay(quote.current.total),
        },
      };
    case "failed":
      return {
        tone: "failed",
        message: quote.message,
        code: quote.code,
      };
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
  if (!eligibility) {
    return {
      disabled: true,
      reason: "Checkout is unavailable until prices are confirmed.",
      eligibilityAllowed: false,
    };
  }
  if (!eligibility.allowed) {
    return {
      disabled: true,
      reason: eligibility.message,
      eligibilityAllowed: false,
      eligibilityReason: eligibility.reason,
    };
  }
  if (!options?.checkoutReady) {
    return {
      disabled: true,
      reason: LIVE_PAYMENT_BLOCKED_REASON,
      eligibilityAllowed: true,
    };
  }
  if (options.inFlight) {
    return {
      disabled: true,
      reason: CHECKOUT_IN_PROGRESS_REASON,
      eligibilityAllowed: true,
    };
  }
  return {
    disabled: false,
    reason: "",
    eligibilityAllowed: true,
  };
}
