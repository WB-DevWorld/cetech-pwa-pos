import { describe, expect, test } from "vitest";
import {
  CHECKOUT_ELIGIBILITY_REASONS,
  describePayButton,
  describeQuoteDisplay,
  formatMoneyDisplay,
  INTEGRATION_UNAVAILABLE,
  isCheckoutEligibilityReason,
  quoteSnapshotAmountRows,
  type QuoteDisplayState,
} from "./quotePresentation";

const snapshot = (minor: number) => ({
  total: { minor, currency: "GHS" },
  subtotal: { minor: minor - 200, currency: "GHS" },
  tax: { minor: 200, currency: "GHS" },
});

describe("FE-04 quote presentation", () => {
  test("formats supplied minor units without inventing a commercial total", () => {
    expect(formatMoneyDisplay({ minor: 1250, currency: "GHS" })).toBe("GHS 12.50");
    expect(formatMoneyDisplay({ minor: 0, currency: "GHS" })).toBe("GHS 0.00");
    expect(formatMoneyDisplay({ minor: 100, currency: "GHS" })).toBe("GHS 1.00");
    expect(formatMoneyDisplay({ minor: 895000, currency: "GHS" })).toBe("GHS 8,950.00");
  });

  test("missing copy does not fabricate a price", () => {
    const view = describeQuoteDisplay({ status: "missing" });
    expect(view.message).toBe("Prices will be ready after an item is added.");
    expect(view.amounts).toBeUndefined();
    expect(view.comparison).toBeUndefined();
  });

  test("quoting is a visible non-blocking wait state", () => {
    const view = describeQuoteDisplay({ status: "quoting", revision: 3 });
    expect(view.message).toBe("Updating price…");
    expect(view.tone).toBe("quoting");
  });

  test("stale asks the cashier to check the price again", () => {
    const view = describeQuoteDisplay({ status: "stale" });
    expect(view.message).toBe("Price needs to be checked again.");
    expect(view.amounts).toBeUndefined();
  });

  test("confirmed displays cashier confirmation without mixing in totals", () => {
    const quote = { status: "confirmed" as const, revision: 2, quote: snapshot(4500) };
    const view = describeQuoteDisplay(quote);
    expect(view.message).toBe("Price ready");
    expect(view.amounts).toBeUndefined();
    expect(quoteSnapshotAmountRows(quote.quote).map((row) => row.label)).toEqual(["Subtotal", "Tax", "Total"]);
    expect(quoteSnapshotAmountRows(quote.quote).map((row) => row.value)).toEqual(["GHS 43.00", "GHS 2.00", "GHS 45.00"]);
  });

  test("zero discount is omitted while tax and total remain visible", () => {
    const rows = quoteSnapshotAmountRows({
      total: { minor: 3000, currency: "GHS" },
      subtotal: { minor: 3000, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
    });
    expect(rows.map((row) => row.label)).toEqual(["Subtotal", "Tax", "Total"]);
    expect(rows.find((row) => row.label === "Discount")).toBeUndefined();
  });

  test("changed discloses previous and current snapshots without replacing one", () => {
    const view = describeQuoteDisplay({
      status: "changed",
      revision: 4,
      previous: snapshot(1000),
      current: snapshot(1800),
    });
    expect(view.message).toMatch(/Price changed/i);
    expect(view.comparison?.previous).toBe("GHS 10.00");
    expect(view.comparison?.current).toBe("GHS 18.00");
    expect(view.amounts).toBeUndefined();
  });

  test("expired is explicit and blocks pay copy independently of totals", () => {
    const view = describeQuoteDisplay({ status: "expired" });
    expect(view.message).toBe("Price needs to be checked again.");
    expect(view.amounts).toBeUndefined();
  });

  test("offline states that a connection is required to check prices and take payment", () => {
    const view = describeQuoteDisplay({ status: "offline" });
    expect(view.message).toMatch(/connection is required/i);
    expect(view.message).toMatch(/check prices/i);
    expect(view.message).toMatch(/browsing/i);
  });

  test("failed maps INTEGRATION_UNAVAILABLE to cashier copy and keeps the code for diagnostics", () => {
    const view = describeQuoteDisplay({
      status: "failed",
      revision: 1,
      code: INTEGRATION_UNAVAILABLE,
      message: "Pricing unavailable — cart saved",
    });
    expect(view.code).toBe("INTEGRATION_UNAVAILABLE");
    expect(view.message).not.toContain("INTEGRATION_UNAVAILABLE");
    expect(view.technicalMessage).toBe("Pricing unavailable — cart saved");
  });

  test("PRICING_UNAVAILABLE is not a failed QuoteState code or checkout eligibility reason", () => {
    expect(CHECKOUT_ELIGIBILITY_REASONS).not.toContain("PRICING_UNAVAILABLE");
    expect(isCheckoutEligibilityReason("PRICING_UNAVAILABLE")).toBe(false);
    expect(isCheckoutEligibilityReason("QUOTE_REQUIRED")).toBe(true);
    expect(INTEGRATION_UNAVAILABLE).not.toBe("PRICING_UNAVAILABLE");
    const failed = describeQuoteDisplay({
      status: "failed",
      revision: 1,
      code: INTEGRATION_UNAVAILABLE,
      message: "Commerce could not confirm prices.",
    });
    expect(failed.code).not.toBe("PRICING_UNAVAILABLE");
  });

  test("failed quote presentation accepts INTEGRATION_UNAVAILABLE and rejects QuoteProblem-only codes at compile time", () => {
    const validFailedQuote: QuoteDisplayState = {
      status: "failed",
      revision: 1,
      code: "INTEGRATION_UNAVAILABLE",
      message: "Pricing unavailable — cart saved",
    };
    expect(validFailedQuote.code).toBe("INTEGRATION_UNAVAILABLE");

    const invalidFailedQuote: QuoteDisplayState = {
      status: "failed",
      revision: 1,
      // @ts-expect-error PRICING_UNAVAILABLE is QuoteProblem-only, not a failed QuoteState code.
      code: "PRICING_UNAVAILABLE",
      message: "Not valid for QuoteState.failed",
    };
    expect(invalidFailedQuote.status).toBe("failed");

    const invalidArbitraryFailedQuote: QuoteDisplayState = {
      status: "failed",
      revision: 1,
      // @ts-expect-error arbitrary strings are not failed quote presentation codes.
      code: "SOMETHING_RANDOM",
      message: "Not a supported failed quote code",
    };
    expect(invalidArbitraryFailedQuote.status).toBe("failed");
  });
});

describe("FE-04 checkout eligibility presentation", () => {
  test("QUOTE_REQUIRED keeps Pay disabled with the supplied reason", () => {
    const pay = describePayButton({
      allowed: false,
      reason: "QUOTE_REQUIRED",
      message: "Checkout is unavailable until the price is ready.",
    });
    expect(pay.disabled).toBe(true);
    expect(pay.eligibilityAllowed).toBe(false);
    expect(pay.eligibilityReason).toBe("QUOTE_REQUIRED");
    expect(pay.reason).toBe("Checkout is unavailable until the price is ready.");
  });

  test("QUOTE_STALE keeps Pay disabled with the supplied reason", () => {
    const pay = describePayButton({
      allowed: false,
      reason: "QUOTE_STALE",
      message: "Refresh pricing before payment.",
    });
    expect(pay.eligibilityReason).toBe("QUOTE_STALE");
    expect(pay.reason).toBe("Refresh pricing before payment.");
    expect(pay.disabled).toBe(true);
  });

  test("QUOTE_EXPIRED keeps Pay disabled with the supplied reason", () => {
    const pay = describePayButton({
      allowed: false,
      reason: "QUOTE_EXPIRED",
      message: "Price needs to be checked again.",
    });
    expect(pay.eligibilityReason).toBe("QUOTE_EXPIRED");
    expect(pay.reason).toBe("Price needs to be checked again.");
  });

  test("CONNECTION_REQUIRED keeps Pay disabled with the supplied reason", () => {
    const pay = describePayButton({
      allowed: false,
      reason: "CONNECTION_REQUIRED",
      message: "Connection required to confirm price",
    });
    expect(pay.eligibilityReason).toBe("CONNECTION_REQUIRED");
    expect(pay.disabled).toBe(true);
  });

  test("allowed true is display evidence only and still does not start payment", () => {
    const pay = describePayButton({ allowed: true });
    expect(pay.disabled).toBe(true);
    expect(pay.eligibilityAllowed).toBe(true);
    expect(pay.reason).toMatch(/payment is available/i);
  });

  test("Pay becomes actionable only when eligibility is allowed and checkout runtime is ready", () => {
    const pay = describePayButton({ allowed: true }, { checkoutReady: true, confirmedTotal: { minor: 3000, currency: "GHS" } });
    expect(pay.disabled).toBe(false);
    expect(pay.eligibilityAllowed).toBe(true);
    expect(pay.reason).toBe("");
    expect(pay.label).toBe("Pay GHS 30.00");
  });

  test("Pay stays disabled while a checkout command is in flight", () => {
    const pay = describePayButton({ allowed: true }, { checkoutReady: true, inFlight: true });
    expect(pay.disabled).toBe(true);
    expect(pay.reason).toMatch(/in progress/i);
  });
});
