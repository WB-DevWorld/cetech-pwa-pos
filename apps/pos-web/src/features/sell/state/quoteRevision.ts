import {
  type CheckoutEligibilityView,
  type QuoteDisplayState,
} from "./quotePresentation";

export type QuotePresentationInput = {
  readonly quote?: QuoteDisplayState;
  readonly eligibility?: CheckoutEligibilityView;
  readonly cartRevision: number;
};

export type ResolvedQuotePresentation = {
  readonly quote?: QuoteDisplayState;
  readonly eligibility?: CheckoutEligibilityView;
};

export function quoteBoundRevision(quote: QuoteDisplayState): number | undefined {
  switch (quote.status) {
    case "quoting":
    case "confirmed":
    case "changed":
    case "failed":
      return quote.revision;
    default:
      return undefined;
  }
}

/** Drop a quote bound to another cart revision. Does not call a pricing port. */
export function alignQuoteToCartRevision(quote: QuoteDisplayState, cartRevision: number): QuoteDisplayState {
  const bound = quoteBoundRevision(quote);
  if (bound === undefined) return quote;
  if (bound !== cartRevision) return { status: "stale" };
  return quote;
}

export function checkoutEligibilityForQuote(quote: QuoteDisplayState): CheckoutEligibilityView {
  switch (quote.status) {
    case "missing":
    case "quoting":
      return {
        allowed: false,
        reason: "QUOTE_REQUIRED",
        message: quote.status === "quoting" ? "Updating price…" : "Checkout is unavailable until prices are confirmed.",
      };
    case "stale":
      return {
        allowed: false,
        reason: "QUOTE_STALE",
        message: "Current pricing is no longer current. Refresh is required before payment.",
      };
    case "expired":
      return { allowed: false, reason: "QUOTE_EXPIRED", message: "Price expired" };
    case "offline":
      return {
        allowed: false,
        reason: "CONNECTION_REQUIRED",
        message: "Connection is required for authoritative pricing and checkout.",
      };
    case "failed":
      return { allowed: false, reason: "QUOTE_REQUIRED", message: quote.message };
    case "changed":
      return {
        allowed: false,
        reason: "QUOTE_REQUIRED",
        message: "Price changed. Review the previous and current quoted totals before continuing.",
      };
    case "confirmed":
      return {
        allowed: false,
        reason: "QUOTE_REQUIRED",
        message: "Price confirmation is required before payment.",
      };
  }
}

/**
 * Revision-safe presentation resolver.
 * Confirmed does not independently allow checkout. Expired/offline/failed never become allowed.
 */
export function resolveQuotePresentation(input: QuotePresentationInput): ResolvedQuotePresentation {
  if (input.quote === undefined && input.eligibility === undefined) {
    return {};
  }

  const quote = input.quote ? alignQuoteToCartRevision(input.quote, input.cartRevision) : undefined;
  if (!quote) {
    return { eligibility: input.eligibility };
  }

  const derived = checkoutEligibilityForQuote(quote);
  const droppedObsoleteQuote = input.quote !== undefined && quote.status === "stale" && input.quote.status !== "stale";
  if (droppedObsoleteQuote) {
    return { quote, eligibility: derived };
  }
  if (quote.status === "confirmed") {
    if (input.eligibility && !input.eligibility.allowed) {
      return { quote, eligibility: input.eligibility };
    }
    if (input.eligibility?.allowed === true) {
      return { quote, eligibility: { allowed: true } };
    }
    return { quote, eligibility: derived };
  }

  if (input.eligibility && !input.eligibility.allowed) {
    return { quote, eligibility: input.eligibility };
  }
  return { quote, eligibility: derived };
}

export function applyQuoteResultForRevision(
  current: QuotePresentationInput,
  resultRevision: number,
  nextQuote: QuoteDisplayState,
): ResolvedQuotePresentation {
  if (resultRevision !== current.cartRevision) {
    return resolveQuotePresentation(current);
  }
  return resolveQuotePresentation({
    cartRevision: current.cartRevision,
    quote: nextQuote,
    eligibility: current.eligibility,
  });
}
