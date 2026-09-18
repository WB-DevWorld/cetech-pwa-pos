import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CartPanel } from "./CartPanel";
import { QuoteStatus } from "./QuoteStatus";
import { INTEGRATION_UNAVAILABLE, type CheckoutEligibilityView, type QuoteDisplayState } from "../state/quotePresentation";

const emptyHandlers = {
  onOpenCustomers: () => undefined,
  onNewSale: () => undefined,
  onIncrement: () => undefined,
  onDecrement: () => undefined,
  onQuantityChange: () => undefined,
  onRemove: () => undefined,
  onCloseMobile: () => undefined,
};

function renderQuote(quote: QuoteDisplayState) {
  return renderToStaticMarkup(createElement(QuoteStatus, { quote }));
}

function renderCart(quote: QuoteDisplayState, eligibility: CheckoutEligibilityView) {
  return renderToStaticMarkup(
    createElement(CartPanel, {
      revision: 2,
      lines: [
        {
          lineId: "line-1",
          catalogItemId: "sku-1",
          name: "Sample line",
          quantity: "1",
        },
      ],
      customer: null,
      mobileOpen: false,
      quote,
      eligibility,
      ...emptyHandlers,
    }),
  );
}

describe("QuoteStatus markup", () => {
  test("missing", () => {
    const html = renderQuote({ status: "missing" });
    expect(html).toContain('data-quote-status="missing"');
    expect(html).toContain("Prices will be ready after an item is added.");
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("GHS");
  });

  test("quoting", () => {
    const html = renderQuote({ status: "quoting", revision: 1 });
    expect(html).toContain('data-quote-status="quoting"');
    expect(html).toContain("Updating price…");
  });

  test("stale", () => {
    const html = renderQuote({ status: "stale" });
    expect(html).toContain('data-quote-status="stale"');
    expect(html).toContain("Price needs to be checked again.");
    expect(html).not.toContain("GHS");
  });

  test("confirmed shows supplied totals", () => {
    const html = renderQuote({
      status: "confirmed",
      revision: 2,
      quote: { total: { minor: 2599, currency: "GHS" }, tax: { minor: 99, currency: "GHS" } },
    });
    expect(html).toContain('data-quote-status="confirmed"');
    expect(html).toContain("Price ready");
    expect(html).toContain("GHS 25.99");
    expect(html).toContain("Tax");
    expect(html).not.toContain("Quoted tax");
    expect(html).toContain("GHS 0.99");
  });

  test("changed keeps previous and current visible", () => {
    const html = renderQuote({
      status: "changed",
      revision: 5,
      previous: { total: { minor: 1000, currency: "GHS" } },
      current: { total: { minor: 1400, currency: "GHS" } },
    });
    expect(html).toContain('data-quote-status="changed"');
    expect(html).toContain("Previous total");
    expect(html).toContain("GHS 10.00");
    expect(html).toContain("New total");
    expect(html).not.toContain("quoted total");
    expect(html).toContain("GHS 14.00");
  });

  test("expired", () => {
    const html = renderQuote({ status: "expired" });
    expect(html).toContain('data-quote-status="expired"');
    expect(html).toContain("Price needs to be checked again.");
  });

  test("offline", () => {
    const html = renderQuote({ status: "offline" });
    expect(html).toContain('data-quote-status="offline"');
    expect(html).toContain("A connection is required to check prices and take payment");
  });

  test("failed INTEGRATION_UNAVAILABLE", () => {
    const html = renderQuote({
      status: "failed",
      revision: 3,
      code: INTEGRATION_UNAVAILABLE,
      message: "Pricing unavailable — cart saved",
    });
    expect(html).toContain('data-quote-status="failed"');
    expect(html).toContain("couldn&#x27;t be checked");
    expect(html).toContain("Technical details");
    expect(html).toContain("INTEGRATION_UNAVAILABLE");
    expect(html).toContain("Pricing unavailable — cart saved");
    expect(html).not.toContain("PRICING_UNAVAILABLE");
  });
});

describe("CartPanel eligibility presentation", () => {
  test("QUOTE_REQUIRED explains disabled Pay", () => {
    const html = renderCart(
      { status: "missing" },
      { allowed: false, reason: "QUOTE_REQUIRED", message: "Checkout is unavailable until the price is ready." },
    );
    expect(html).toContain('data-eligibility-reason="QUOTE_REQUIRED"');
    expect(html).toContain("Checkout is unavailable until the price is ready.");
    expect(html).toMatch(/pay-btn[^>]*disabled/);
  });

  test("QUOTE_STALE explains disabled Pay", () => {
    const html = renderCart(
      { status: "stale" },
      { allowed: false, reason: "QUOTE_STALE", message: "Refresh pricing before payment." },
    );
    expect(html).toContain('data-eligibility-reason="QUOTE_STALE"');
    expect(html).toContain("Refresh pricing before payment.");
  });

  test("QUOTE_EXPIRED explains disabled Pay", () => {
    const html = renderCart(
      { status: "expired" },
      { allowed: false, reason: "QUOTE_EXPIRED", message: "Price needs to be checked again." },
    );
    expect(html).toContain('data-eligibility-reason="QUOTE_EXPIRED"');
    expect(html).toContain("Price needs to be checked again.");
  });

  test("CONNECTION_REQUIRED explains disabled Pay", () => {
    const html = renderCart(
      { status: "offline" },
      { allowed: false, reason: "CONNECTION_REQUIRED", message: "Connection required to confirm price" },
    );
    expect(html).toContain('data-eligibility-reason="CONNECTION_REQUIRED"');
    expect(html).toContain("Connection required to confirm price");
  });

  test("confirmed plus allowed true still cannot start payment", () => {
    const html = renderCart(
      { status: "confirmed", revision: 2, quote: { total: { minor: 500, currency: "GHS" } } },
      { allowed: true },
    );
    expect(html).toContain('data-eligibility-allowed="true"');
    expect(html).toMatch(/pay-btn[^>]*disabled/);
    expect(html).toContain("Review the price, then continue when payment is available.");
    expect(html).not.toContain("PRICING_UNAVAILABLE");
  });

  test("Pay is enabled when eligibility is allowed and checkout runtime is supplied", () => {
    const html = renderToStaticMarkup(
      createElement(CartPanel, {
        revision: 2,
        lines: [
          {
            lineId: "line-1",
            catalogItemId: "sku-1",
            name: "Sample line",
            quantity: "1",
          },
        ],
        customer: null,
        mobileOpen: false,
        quote: { status: "confirmed", revision: 2, quote: { total: { minor: 500, currency: "GHS" } } },
        eligibility: { allowed: true },
        checkoutReady: true,
        onPay: () => undefined,
        ...emptyHandlers,
      }),
    );
    expect(html).toContain('data-eligibility-allowed="true"');
    expect(html).not.toMatch(/pay-btn[^>]*disabled/);
    expect(html).not.toContain("Review the price, then continue when payment is available.");
  });
});
