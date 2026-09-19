import type { CheckoutEligibility, QuoteState } from "../../../../../../docs/contracts/domain.generated";
import { describeQuoteFailure, describeUnpurchasableQuote } from "../../../ui/cashier-language";

export type QuoteEligibilityInput = {
  readonly cartEmpty: boolean;
  readonly shiftOpen: boolean;
  readonly online: boolean;
  readonly quote: QuoteState;
  readonly cartLines?: readonly { readonly lineId: string; readonly name: string }[];
};

function cartLineNames(lines: QuoteEligibilityInput["cartLines"]): readonly string[] | undefined {
  return lines?.map((line) => line.name);
}

export function checkoutEligibilityFromQuote(input: QuoteEligibilityInput): CheckoutEligibility {
  const names = cartLineNames(input.cartLines);
  if (!input.shiftOpen) {
    return { allowed: false, reason: "NO_ACTIVE_SHIFT", message: "Start your shift before taking payment." };
  }
  if (input.cartEmpty) {
    return { allowed: false, reason: "CART_EMPTY", message: "Add an item before checkout." };
  }
  if (!input.online || input.quote.status === "offline") {
    return {
      allowed: false,
      reason: "CONNECTION_REQUIRED",
      message: "A connection is required to check prices and take payment.",
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
              ? describeQuoteFailure({
                  code: input.quote.code,
                  message: input.quote.message,
                  cartLineNames: names,
                }).message
              : input.quote.status === "changed"
                ? "Price changed. Review the old and new total before continuing."
                : "Checkout is unavailable until the price is ready.",
      };
    case "stale":
      return {
        allowed: false,
        reason: "QUOTE_STALE",
        message: "Price needs to be checked again.",
      };
    case "expired":
      return { allowed: false, reason: "QUOTE_EXPIRED", message: "Price needs to be checked again." };
    case "confirmed":
      if (!input.quote.quote.purchasable) {
        return {
          allowed: false,
          reason: "PRODUCT_UNAVAILABLE",
          message: describeUnpurchasableQuote({
            cartLineNames: names,
            quoteLines: input.quote.quote.lines.map((line) => ({
              name: input.cartLines?.find((cartLine) => cartLine.lineId === line.lineId)?.name,
              stockStatus: line.stockStatus,
              purchasable: line.purchasable,
              problems: line.problems,
            })),
          }),
        };
      }
      return { allowed: true };
  }
}
