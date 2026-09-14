import { describe, expect, test } from "vitest";
import {
  canBeginNewSale,
  checkoutCommandInFlight,
  checkoutDialogOpen,
  formatMinorDecimal,
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

  test("dialog and in-flight flags stay distinct", () => {
    expect(checkoutDialogOpen("idle")).toBe(false);
    expect(checkoutDialogOpen("cash")).toBe(true);
    expect(checkoutCommandInFlight("cash")).toBe(false);
    expect(checkoutCommandInFlight("preparing")).toBe(true);
    expect(checkoutCommandInFlight("finalizing")).toBe(true);
  });
});
