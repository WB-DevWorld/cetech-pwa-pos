import type { CheckoutEligibility, QuoteState } from "../../../../../../docs/contracts/domain.generated";

export type QuoteEligibilityInput = {
  readonly cartEmpty: boolean;
  readonly shiftOpen: boolean;
  readonly online: boolean;
  readonly quote: QuoteState;
};

export function checkoutEligibilityFromQuote(input: QuoteEligibilityInput): CheckoutEligibility {
  if (!input.shiftOpen) {
    return { allowed: false, reason: "NO_ACTIVE_SHIFT", message: "An open shift is required before payment." };
  }
  if (input.cartEmpty) {
    return { allowed: false, reason: "CART_EMPTY", message: "Add an item before checkout." };
  }
  if (!input.online || input.quote.status === "offline") {
    return {
      allowed: false,
      reason: "CONNECTION_REQUIRED",
      message: "Connection is required for authoritative pricing and checkout.",
    };
  }
  switch (input.quote.status) {
    case "missing":
    case "quoting":
    case "failed":
    case "changed":
      return {
        allowed: false,
        reason: "QUOTE_REQUIRED",
        message:
          input.quote.status === "quoting"
            ? "Updating price…"
            : input.quote.status === "failed"
              ? input.quote.message
              : input.quote.status === "changed"
                ? "Price changed. Review the previous and current quoted totals before continuing."
                : "Checkout is unavailable until prices are confirmed.",
      };
    case "stale":
      return {
        allowed: false,
        reason: "QUOTE_STALE",
        message: "Current pricing is no longer current. Refresh is required before payment.",
      };
    case "expired":
      return { allowed: false, reason: "QUOTE_EXPIRED", message: "Price expired" };
    case "confirmed":
      if (!input.quote.quote.purchasable) {
        return {
          allowed: false,
          reason: "PRODUCT_UNAVAILABLE",
          message: "A quoted item is not purchasable.",
        };
      }
      return { allowed: true };
  }
}
