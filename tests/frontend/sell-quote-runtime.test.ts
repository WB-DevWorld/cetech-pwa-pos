import { describe, expect, test } from "vitest";
import type { Quote } from "../../docs/contracts/domain.generated";
import type { PricingPort } from "../../docs/contracts/ports";
import { checkoutEligibilityFromQuote } from "../../apps/pos-web/src/features/sell/runtime/checkoutEligibility";
import {
  applyQuoteStateForRevision,
  expireQuoteIfNeeded,
  requestWholeCartQuote,
  quotingState,
} from "../../apps/pos-web/src/features/sell/runtime/quoteRequest";
import { quoteStateToDisplay } from "../../apps/pos-web/src/features/sell/runtime/mapQuoteDisplay";

const CART = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LINE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function quoteFixture(revision: number, totalMinor: number, fingerprint: string, expiresAt = "2026-09-13T21:00:00.000Z"): Quote {
  return {
    id: `quote-${fingerprint}`,
    fingerprint,
    cartId: CART,
    cartRevision: revision,
    customer: { kind: "walkin" },
    locationId: "loc-front-1",
    currency: "GHS",
    lines: [
      {
        lineId: LINE,
        productId: "p-hardener",
        quantity: "1",
        unitPrice: { minor: totalMinor, currency: "GHS" },
        subtotal: { minor: totalMinor, currency: "GHS" },
        discount: { minor: 0, currency: "GHS" },
        tax: { minor: 0, currency: "GHS" },
        total: { minor: totalMinor, currency: "GHS" },
        stockStatus: "in_stock",
        purchasable: true,
        problems: [],
      },
    ],
    subtotal: { minor: totalMinor, currency: "GHS" },
    discount: { minor: 0, currency: "GHS" },
    tax: { minor: 0, currency: "GHS" },
    total: { minor: totalMinor, currency: "GHS" },
    calculatedAt: "2026-09-13T20:00:00.000Z",
    expiresAt,
    purchasable: true,
  };
}

describe("FE-04 whole-cart quote revision safety", () => {
  test("a delayed revision-1 quote cannot overwrite revision 2", () => {
    const quoting = quotingState(2);
    const late = {
      status: "confirmed" as const,
      revision: 1,
      quote: quoteFixture(1, 1500, "old"),
    };
    const kept = applyQuoteStateForRevision({
      currentRevision: 2,
      resultRevision: 1,
      nowIso: "2026-09-13T20:30:00.000Z",
      previous: quoting,
      next: late,
    });
    expect(kept).toEqual(quoting);
  });

  test("expired confirmed quote blocks payment", () => {
    const confirmed = {
      status: "confirmed" as const,
      revision: 3,
      quote: quoteFixture(3, 1500, "now", "2026-09-13T20:00:00.000Z"),
    };
    const expired = expireQuoteIfNeeded(confirmed, "2026-09-13T20:00:01.000Z");
    expect(expired.status).toBe("expired");
    expect(
      checkoutEligibilityFromQuote({
        cartEmpty: false,
        shiftOpen: true,
        online: true,
        quote: expired,
      }),
    ).toMatchObject({ allowed: false, reason: "QUOTE_EXPIRED" });
  });

  test("offline quote blocks payment even with a prior confirmed total", () => {
    expect(
      checkoutEligibilityFromQuote({
        cartEmpty: false,
        shiftOpen: true,
        online: false,
        quote: { status: "offline" },
      }),
    ).toMatchObject({ allowed: false, reason: "CONNECTION_REQUIRED" });
  });

  test("customer or cart revision requotes and displays the authoritative total only", async () => {
    const quotes: Quote[] = [quoteFixture(1, 1500, "a"), quoteFixture(2, 1800, "b")];
    const pricing: PricingPort = {
      async quote(input) {
        const data = quotes.find((item) => item.cartRevision === input.cartRevision) ?? quotes[0]!;
        return { ok: true, data, correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
      },
    };
    const first = await requestWholeCartQuote(pricing, {
      cartId: CART,
      cartRevision: 1,
      customer: { kind: "walkin" },
      locationId: "loc-front-1",
      lines: [{ lineId: LINE, productId: "p-hardener", quantity: "1" }],
    }, { status: "missing" });
    const second = await requestWholeCartQuote(pricing, {
      cartId: CART,
      cartRevision: 2,
      customer: { kind: "b2b", customerId: "cust-buildworks" },
      locationId: "loc-front-1",
      lines: [{ lineId: LINE, productId: "p-hardener", quantity: "1" }],
    }, first);
    expect(first.status).toBe("confirmed");
    expect(second.status).toBe("confirmed");
    if (first.status === "confirmed" && second.status === "confirmed") {
      expect(first.quote.total.minor).toBe(1500);
      expect(second.quote.total.minor).toBe(1800);
      expect(quoteStateToDisplay(second)).toMatchObject({
        status: "confirmed",
        quote: { total: { minor: 1800, currency: "GHS" } },
      });
    }
  });

  test("fingerprint change on the same revision is an explicit review state", async () => {
    const pricing: PricingPort = {
      async quote() {
        return {
          ok: true,
          data: quoteFixture(4, 1900, "after"),
          correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        };
      },
    };
    const previous = {
      status: "confirmed" as const,
      revision: 4,
      quote: quoteFixture(4, 1500, "before"),
    };
    const next = await requestWholeCartQuote(
      pricing,
      {
        cartId: CART,
        cartRevision: 4,
        customer: { kind: "walkin" },
        locationId: "loc-front-1",
        lines: [{ lineId: LINE, productId: "p-hardener", quantity: "1" }],
      },
      previous,
    );
    expect(next.status).toBe("changed");
    if (next.status === "changed") {
      expect(next.previous.total.minor).toBe(1500);
      expect(next.current.total.minor).toBe(1900);
    }
    expect(
      checkoutEligibilityFromQuote({
        cartEmpty: false,
        shiftOpen: true,
        online: true,
        quote: next,
      }).allowed,
    ).toBe(false);
  });

  test("Pay stays disallowed from a failed quote, distinct from stale or offline", async () => {
    const pricing: PricingPort = {
      async quote() {
        return {
          ok: false,
          error: {
            code: "INTEGRATION_UNAVAILABLE",
            message: "Bridge quote is unavailable.",
            retryable: true,
            nextAction: "retry_same_key",
          },
          correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        };
      },
    };
    const failed = await requestWholeCartQuote(
      pricing,
      {
        cartId: CART,
        cartRevision: 1,
        customer: { kind: "walkin" },
        locationId: "loc-front-1",
        lines: [{ lineId: LINE, productId: "p-hardener", quantity: "1" }],
      },
      { status: "missing" },
    );
    expect(failed.status).toBe("failed");
    const eligibility = checkoutEligibilityFromQuote({
      cartEmpty: false,
      shiftOpen: true,
      online: true,
      quote: failed,
    });
    expect(eligibility).toMatchObject({ allowed: false, reason: "QUOTE_REQUIRED" });
    expect(
      checkoutEligibilityFromQuote({
        cartEmpty: false,
        shiftOpen: true,
        online: true,
        quote: { status: "stale" },
      }).reason,
    ).toBe("QUOTE_STALE");
  });
});
