import {
  describeUnavailableItems,
  toCashierError,
  type CashierErrorView,
} from "./toCashierError";

export type QuoteFailureLine = {
  readonly name?: string;
  readonly stockStatus?: string;
  readonly purchasable?: boolean;
  readonly problems?: readonly { readonly code: string }[];
};

export type DescribeQuoteFailureInput = {
  readonly code?: string;
  readonly message?: string;
  readonly cartLineNames?: readonly string[];
  readonly quoteLines?: readonly QuoteFailureLine[];
};

function authoritativeOutOfStockName(lines: readonly QuoteFailureLine[] | undefined): string | undefined {
  if (!lines) return undefined;
  const named = lines.filter((line) => {
    const oos =
      line.stockStatus === "out_of_stock" ||
      Boolean(line.problems?.some((problem) => problem.code === "OUT_OF_STOCK"));
    return oos && Boolean(line.name?.trim());
  });
  if (named.length === 1) {
    return named[0]?.name?.trim();
  }
  return undefined;
}

export function describeQuoteFailure(input: DescribeQuoteFailureInput): CashierErrorView {
  const authoritative = authoritativeOutOfStockName(input.quoteLines);
  return toCashierError({
    code: input.code,
    message: input.message,
    domain: "quote",
    cartLineNames: input.cartLineNames,
    authoritativeOutOfStockName: authoritative,
  });
}

export function describeUnpurchasableQuote(input: {
  readonly cartLineNames?: readonly string[];
  readonly quoteLines?: readonly QuoteFailureLine[];
}): string {
  const authoritative = authoritativeOutOfStockName(input.quoteLines);
  return describeUnavailableItems({
    cartLineNames: input.cartLineNames,
    authoritativeOutOfStockName: authoritative,
  });
}
