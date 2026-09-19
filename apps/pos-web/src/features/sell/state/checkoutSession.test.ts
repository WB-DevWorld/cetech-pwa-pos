import { describe, expect, test } from "vitest";
import {
  canBeginNewSale,
  checkoutCommandInFlight,
  checkoutDialogOpen,
  checkoutDismissAllowed,
  formatMinorDecimal,
  hasOutstandingPreparedSale,
  idleCheckoutSession,
} from "./checkoutSession";

describe("FE-05 checkout session helpers", () => {
  test("formats supplied minor units as decimal input without floating-point math", () => {
    expect(formatMinorDecimal(1500)).toBe("15.00");
    expect(formatMinorDecimal(5)).toBe("0.05");
  });

  test("blocks a new sale during uncertain or in-flight checkout", () => {
    expect(canBeginNewSale({ ...idleCheckoutSession(), stage: "resolving_sale" })).toBe(false);
    expect(canBeginNewSale({ ...idleCheckoutSession(), stage: "confirming_cash" })).toBe(false);
    expect(canBeginNewSale({ ...idleCheckoutSession(), stage: "finalizing" })).toBe(false);
    expect(canBeginNewSale({ ...idleCheckoutSession(), stage: "prepare_failed" })).toBe(true);
    expect(
      canBeginNewSale({
        ...idleCheckoutSession(),
        stage: "receipt_ready",
        saleCompleted: true,
      }),
    ).toBe(true);
  });

  test("a prepared sale cannot be dismissed or replaced with a new sale", () => {
    const choose = {
      ...idleCheckoutSession(),
      stage: "choose_payment" as const,
      prepared: {
        transactionId: "tx",
        saleId: "sale",
        orderReference: "POS-1",
        quoteFingerprint: "fp",
        total: { minor: 1500, currency: "GHS" },
      },
    };
    const cash = { ...choose, stage: "cash" as const };
    const cashFailed = { ...cash, stage: "cash_failed" as const };
    expect(hasOutstandingPreparedSale(choose)).toBe(true);
    expect(hasOutstandingPreparedSale(cash)).toBe(true);
    expect(checkoutDismissAllowed(cash)).toBe(false);
    expect(checkoutDismissAllowed(cashFailed)).toBe(false);
    expect(canBeginNewSale(cash)).toBe(false);
    expect(canBeginNewSale(choose)).toBe(false);
    expect(checkoutDismissAllowed({ ...idleCheckoutSession(), stage: "prepare_failed" })).toBe(true);
  });

  test("dialog and in-flight flags stay distinct", () => {
    expect(checkoutDialogOpen("idle")).toBe(false);
    expect(checkoutDialogOpen("choose_payment")).toBe(true);
    expect(checkoutDialogOpen("cash")).toBe(true);
    expect(checkoutCommandInFlight("cash")).toBe(false);
    expect(checkoutCommandInFlight("choose_payment")).toBe(false);
    expect(checkoutCommandInFlight("preparing")).toBe(true);
    expect(checkoutCommandInFlight("cancelling")).toBe(true);
    expect(checkoutCommandInFlight("finalizing")).toBe(true);
  });
});
