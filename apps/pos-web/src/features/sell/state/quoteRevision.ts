import {
  type CheckoutEligibilityView,
  type QuoteDisplayState,
} from "./quotePresentation";
import { describeQuoteFailure } from "../../../ui/cashier-language";

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
        message: quote.status === "quoting" ? "Updating price…" : "Checkout is unavailable until the price is ready.",
      };
    case "stale":
      return {
        allowed: false,
        reason: "QUOTE_STALE",
        message: "Price needs to be checked again.",
      };
    case "expired":
      return { allowed: false, reason: "QUOTE_EXPIRED", message: "Price needs to be checked again." };
    case "offline":
      return {
        allowed: false,
        reason: "CONNECTION_REQUIRED",
        message: "A connection is required to check prices and take payment.",
      };
    case "failed":
      return {
        allowed: false,
        reason: "QUOTE_REQUIRED",
        message: describeQuoteFailure({ code: quote.code, message: quote.message }).message,
      };
    case "changed":
      return {
        allowed: false,
        reason: "QUOTE_REQUIRED",
        message: "Price changed. Review the old and new total before continuing.",
      };
    case "confirmed":
      return {
        allowed: false,
        reason: "QUOTE_REQUIRED",
        message: "Checkout is unavailable until the price is ready.",
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
