import { describe, expect, test } from "vitest";
import { resolvePaymentMethodCapabilities } from "./method-capabilities";

describe("payment method capabilities", () => {
  test("disabled provider leaves electronic methods unconfigured", () => {
    expect(resolvePaymentMethodCapabilities({ PAYMENT_PROVIDER: "disabled" })).toEqual({
      cash: "available",
      mobileMoney: "unconfigured",
      card: "unconfigured",
      externalTerminal: "unconfigured",
    });
  });

  test("Paystack test enables only card and mobile money", () => {
    const capabilities = resolvePaymentMethodCapabilities({
      PAYMENT_PROVIDER: "paystack",
      PAYSTACK_MODE: "test",
      PAYSTACK_SECRET_KEY: "sk_test_example_key",
    });
    expect(capabilities.cash).toBe("available");
    expect(capabilities.mobileMoney).toBe("configured");
    expect(capabilities.card).toBe("configured");
    expect(capabilities.externalTerminal).toBe("unconfigured");
    expect(JSON.stringify(capabilities)).not.toContain("sk_test");
  });

  test("unsafe or live Paystack configuration marks electronic methods unavailable", () => {
    expect(
      resolvePaymentMethodCapabilities({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "live",
        PAYSTACK_SECRET_KEY: "sk_test_example_key",
      }).card,
    ).toBe("unavailable");
    expect(
      resolvePaymentMethodCapabilities({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "not-a-paystack-key",
      }).mobileMoney,
    ).toBe("unavailable");
  });
});
