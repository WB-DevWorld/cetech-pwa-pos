/**
 * Presentation-only error mapper. Canonical ApiErrorCode values stay unchanged.
 * Raw backend/provider/server text is never cashier-safe by default.
 * Raw code/message are preserved for Technical details and logs.
 */

export type CashierErrorDomain =
  | "quote"
  | "payment"
  | "catalog"
  | "health"
  | "auth"
  | "register"
  | "returns"
  | "orders"
  | "customers"
  | "generic";

export type CashierErrorSource = "backend" | "presentation";

export type CashierErrorInput = {
  readonly code?: string;
  readonly message?: string;
  readonly domain?: CashierErrorDomain;
  readonly cartLineNames?: readonly string[];
  readonly authoritativeOutOfStockName?: string;
  /** Locally authored cashier copy. Never set this for backend/provider/server strings. */
  readonly source?: CashierErrorSource;
};

export type CashierErrorView = {
  readonly message: string;
  readonly technical: {
    readonly code?: string;
    readonly message?: string;
  };
};

const DO_NOT_CHARGE_AGAIN = "Do not charge again.";

export function looksLikeProviderLineRejection(message: string | undefined): boolean {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes("rejected a quote line") ||
    text.includes("not purchasable") ||
    text.includes("cannot be purchased") ||
    text.includes("can't be sold") ||
    text.includes("product_not_purchasable")
  );
}

function looksLikeOutOfStockMessage(message: string | undefined): boolean {
  if (!message) return false;
  const text = message.toLowerCase();
  return text.includes("out of stock") || text.includes("out_of_stock") || text.includes("outofstock");
}

function singleCartLineName(names: readonly string[] | undefined): string | undefined {
  if (!names || names.length !== 1) return undefined;
  const name = names[0]?.trim();
  return name ? name : undefined;
}

export function describeUnavailableItems(input: {
  readonly cartLineNames?: readonly string[];
  readonly authoritativeOutOfStockName?: string;
  readonly providerMessage?: string;
}): string {
  if (input.authoritativeOutOfStockName) {
    return `${input.authoritativeOutOfStockName} is out of stock. Remove it to continue.`;
  }
  const single = singleCartLineName(input.cartLineNames);
  if (single && looksLikeOutOfStockMessage(input.providerMessage)) {
    return `${single} is out of stock. Remove it to continue.`;
  }
  if (single) {
    return `${single} can't be sold right now. Remove it or refresh products and try again.`;
  }
  return "One or more items can't be sold right now. Remove unavailable items or refresh products and try again.";
}

export function domainFallback(domain: CashierErrorDomain): string {
  switch (domain) {
    case "quote":
      return "Prices couldn't be checked. Check the connection and try again.";
    case "catalog":
      return "Products couldn't be loaded. Check the connection and try again.";
    case "payment":
      return "Payment couldn't be completed. Check the connection. Do not charge again if a payment may already have started.";
    case "health":
      return "System status couldn't be refreshed. Check the connection and try again.";
    case "auth":
      return "Sign-in is temporarily unavailable. Try again.";
    case "register":
      return "Register details couldn't be loaded. Check the connection and try again.";
    case "returns":
      return "This return couldn't be completed. Check the connection and try again.";
    case "orders":
      return "Orders couldn't be loaded. Check the connection and try again.";
    case "customers":
      return "Customer search is unavailable. You can continue as Walk-in from Sell.";
    default:
      return "This action couldn't be completed. Try again or contact a manager.";
  }
}

function integrationUnavailableMessage(domain: CashierErrorDomain, input: CashierErrorInput): string {
  if (looksLikeProviderLineRejection(input.message) || input.code === "STOCK_CHANGED") {
    return describeUnavailableItems({
      cartLineNames: input.cartLineNames,
      authoritativeOutOfStockName: input.authoritativeOutOfStockName,
      providerMessage: input.message,
    });
  }
  return domainFallback(domain);
}

export function cashierErrorMessage(
  error: { readonly code?: string; readonly message?: string } | undefined,
  domain: CashierErrorDomain,
  extras?: Pick<CashierErrorInput, "cartLineNames" | "authoritativeOutOfStockName">,
): string {
  return toCashierError({
    code: error?.code,
    message: error?.message,
    domain,
    cartLineNames: extras?.cartLineNames,
    authoritativeOutOfStockName: extras?.authoritativeOutOfStockName,
  }).message;
}

export function toCashierError(input: CashierErrorInput): CashierErrorView {
  const domain = input.domain ?? "generic";
  const technical = { code: input.code, message: input.message };
  const code = input.code;

  if (input.source === "presentation") {
    const trimmed = input.message?.trim();
    return { message: trimmed || domainFallback(domain), technical };
  }

  if (code === "SHIFT_REQUIRED") {
    return { message: "Start your shift before taking payment.", technical };
  }
  if (code === "QUOTE_EXPIRED" || code === "QUOTE_CHANGED") {
    return { message: "Price needs to be checked again.", technical };
  }
  if (code === "AUTH_REQUIRED") {
    return { message: "Your session ended. Sign in again.", technical };
  }
  if (code === "FORBIDDEN") {
    return { message: "You don't have permission to do this.", technical };
  }
  if (code === "PAYMENT_PENDING" || code === "PAYMENT_NOT_VERIFIED") {
    return { message: `Payment is still being checked. ${DO_NOT_CHARGE_AGAIN}`, technical };
  }
  if (code === "REQUIRES_ATTENTION") {
    return { message: "This needs manual review. Contact a manager or support.", technical };
  }
  if (code === "NOT_FOUND") {
    return { message: "That record was not found. Check the details and try again.", technical };
  }
  if (code === "VALIDATION_ERROR") {
    if (looksLikeProviderLineRejection(input.message) || looksLikeOutOfStockMessage(input.message)) {
      return {
        message: describeUnavailableItems({
          cartLineNames: input.cartLineNames,
          authoritativeOutOfStockName: input.authoritativeOutOfStockName,
          providerMessage: input.message,
        }),
        technical,
      };
    }
    return { message: "Check the details and try again.", technical };
  }
  if (code === "SHIFT_CONFLICT") {
    return { message: "This register already has an open shift. Refresh and continue from the current shift.", technical };
  }
  if (code === "OPERATION_IN_PROGRESS" || code === "IDEMPOTENCY_CONFLICT") {
    return { message: "This action is already in progress. Wait, then check status. Do not start it again.", technical };
  }
  if (code === "RATE_LIMITED") {
    return { message: "Too many attempts. Wait a moment and try again.", technical };
  }
  if (code === "UNSUPPORTED_VERSION") {
    return { message: "This app version can't complete that action. Update or contact support.", technical };
  }
  if (input.authoritativeOutOfStockName || looksLikeProviderLineRejection(input.message) || code === "STOCK_CHANGED") {
    return {
      message: describeUnavailableItems({
        cartLineNames: input.cartLineNames,
        authoritativeOutOfStockName: input.authoritativeOutOfStockName,
        providerMessage: input.message,
      }),
      technical,
    };
  }
  if (code === "INTEGRATION_UNAVAILABLE") {
    return { message: integrationUnavailableMessage(domain, input), technical };
  }

  return { message: domainFallback(domain), technical };
}

export function containsProhibitedCashierTerm(text: string): boolean {
  return (
    /\b(INTEGRATION_UNAVAILABLE|IndexedDB|WooCommerce|B2BKing|WoodMart|WS3|API contract|Local schema|provider callback|server-owned|mounted source|idempotency|payment identity|catalog projection)\b/i.test(
      text,
    ) || /Cart\s*·\s*Rev/i.test(text)
  );
}
