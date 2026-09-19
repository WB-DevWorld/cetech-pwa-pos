import { describe, expect, test } from "vitest";
import { INTEGRATION_UNAVAILABLE } from "./quotePresentation";
import {
  alignQuoteToCartRevision,
  applyQuoteResultForRevision,
  checkoutEligibilityForQuote,
  quoteBoundRevision,
  resolveQuotePresentation,
} from "./quoteRevision";

const confirmed = {
  status: "confirmed" as const,
  revision: 2,
  quote: { total: { minor: 1500, currency: "GHS" } },
};

describe("FE-04 revision-safe quote presentation", () => {
  test("quote request state is bound to cart revision N", () => {
    const quoting = { status: "quoting" as const, revision: 4 };
    expect(quoteBoundRevision(quoting)).toBe(4);
    expect(alignQuoteToCartRevision(quoting, 4)).toEqual(quoting);
    expect(checkoutEligibilityForQuote(quoting).allowed).toBe(false);
  });

  test("cart mutation to N+1 stales a quote bound to N", () => {
    expect(alignQuoteToCartRevision(confirmed, 3)).toEqual({ status: "stale" });
    const presented = resolveQuotePresentation({ quote: confirmed, cartRevision: 3 });
    expect(presented.quote).toEqual({ status: "stale" });
    expect(presented.eligibility).toEqual({
      allowed: false,
      reason: "QUOTE_STALE",
      message: "Price needs to be checked again.",
    });
  });

  test("customer change that advances revision invalidates the prior quote", () => {
    const presented = resolveQuotePresentation({
      quote: confirmed,
      eligibility: { allowed: true },
      cartRevision: confirmed.revision + 1,
    });
    expect(presented.quote?.status).toBe("stale");
    expect(presented.eligibility?.allowed).toBe(false);
    if (presented.eligibility && !presented.eligibility.allowed) {
      expect(presented.eligibility.reason).toBe("QUOTE_STALE");
    }
  });

  test("an old result for revision N cannot overwrite current revision N+1", () => {
    const current = {
      cartRevision: 5,
      quote: { status: "quoting" as const, revision: 5 },
    };
    const ignored = applyQuoteResultForRevision(current, 4, confirmed);
    expect(ignored.quote).toEqual({ status: "quoting", revision: 5 });
    expect(ignored.quote).not.toEqual(confirmed);
    const accepted = applyQuoteResultForRevision(current, 5, { ...confirmed, revision: 5 });
    expect(accepted.quote).toEqual({ ...confirmed, revision: 5 });
  });

  test("expired cannot become checkout-ready", () => {
    const presented = resolveQuotePresentation({
      quote: { status: "expired" },
      eligibility: { allowed: true },
      cartRevision: 2,
    });
    expect(presented.quote?.status).toBe("expired");
    expect(presented.eligibility).toEqual({ allowed: false, reason: "QUOTE_EXPIRED", message: "Price needs to be checked again." });
  });

  test("offline cannot become checkout-ready", () => {
    const presented = resolveQuotePresentation({
      quote: { status: "offline" },
      eligibility: { allowed: true },
      cartRevision: 2,
    });
    expect(presented.eligibility).toEqual({
      allowed: false,
      reason: "CONNECTION_REQUIRED",
      message: "A connection is required to check prices and take payment.",
    });
  });

  test("failed cannot become checkout-ready", () => {
    const presented = resolveQuotePresentation({
      quote: {
        status: "failed",
        revision: 2,
        code: INTEGRATION_UNAVAILABLE,
        message: "Pricing unavailable — cart saved",
      },
      eligibility: { allowed: true },
      cartRevision: 2,
    });
    expect(presented.quote?.status).toBe("failed");
    expect(presented.eligibility?.allowed).toBe(false);
    if (presented.eligibility && !presented.eligibility.allowed) {
      expect(presented.eligibility.reason).toBe("QUOTE_REQUIRED");
    }
  });

  test("confirmed does not independently allow checkout unless eligibility is supplied", () => {
    const withoutEligibility = resolveQuotePresentation({ quote: confirmed, cartRevision: 2 });
    expect(withoutEligibility.quote?.status).toBe("confirmed");
    expect(withoutEligibility.eligibility?.allowed).toBe(false);
    const mockAllowed = resolveQuotePresentation({
      quote: confirmed,
      eligibility: { allowed: true },
      cartRevision: 2,
    });
    expect(mockAllowed.eligibility).toEqual({ allowed: true });
  });
});
