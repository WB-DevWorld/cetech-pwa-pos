import { describe, expect, test } from "vitest";
import {
  capabilityForElectronicTender,
  resolvePaymentMethodCapabilities,
} from "./method-capabilities";

describe("payment method capabilities", () => {
  test("disabled provider leaves electronic methods unconfigured", () => {
    expect(resolvePaymentMethodCapabilities({ PAYMENT_PROVIDER: "disabled" })).toEqual({
      cash: "available",
      mobileMoney: "unconfigured",
      card: "unconfigured",
      externalTerminal: "unconfigured",
    });
  });

  test("Paystack credentials alone do not imply card or mobile money availability", () => {
    expect(
      resolvePaymentMethodCapabilities({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "sk_test_example_key",
      }),
    ).toEqual({
      cash: "available",
      mobileMoney: "unconfigured",
      card: "unconfigured",
      externalTerminal: "unconfigured",
    });
  });

  test("Paystack methods are enabled independently by server-owned configuration", () => {
    const mobileOnly = resolvePaymentMethodCapabilities({
      PAYMENT_PROVIDER: "paystack",
      PAYSTACK_MODE: "test",
      PAYSTACK_SECRET_KEY: "sk_test_example_key",
      PAYSTACK_MOBILE_MONEY_ENABLED: "true",
      PAYSTACK_CARD_ENABLED: "false",
    });
    expect(mobileOnly.mobileMoney).toBe("configured");
    expect(mobileOnly.card).toBe("unconfigured");

    const cardOnly = resolvePaymentMethodCapabilities({
      PAYMENT_PROVIDER: "paystack",
      PAYSTACK_MODE: "test",
      PAYSTACK_SECRET_KEY: "sk_test_example_key",
      PAYSTACK_MOBILE_MONEY_ENABLED: "false",
      PAYSTACK_CARD_ENABLED: "true",
    });
    expect(cardOnly.mobileMoney).toBe("unconfigured");
    expect(cardOnly.card).toBe("configured");
    expect(cardOnly.externalTerminal).toBe("unconfigured");
    expect(JSON.stringify(cardOnly)).not.toContain("sk_test");
  });

  test("tender lookup maps external electronic separately from Paystack methods", () => {
    const capabilities = resolvePaymentMethodCapabilities({
      PAYMENT_PROVIDER: "paystack",
      PAYSTACK_MODE: "test",
      PAYSTACK_SECRET_KEY: "sk_test_example_key",
      PAYSTACK_MOBILE_MONEY_ENABLED: "true",
      PAYSTACK_CARD_ENABLED: "false",
    });
    expect(capabilityForElectronicTender(capabilities, "mobile_money")).toBe("configured");
    expect(capabilityForElectronicTender(capabilities, "card")).toBe("unconfigured");
    expect(capabilityForElectronicTender(capabilities, "external_electronic")).toBe("unconfigured");
  });

  test("unsafe or live Paystack configuration marks electronic methods unavailable", () => {
    expect(
      resolvePaymentMethodCapabilities({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "live",
        PAYSTACK_SECRET_KEY: "sk_test_example_key",
        PAYSTACK_CARD_ENABLED: "true",
      }).card,
    ).toBe("unavailable");
    expect(
      resolvePaymentMethodCapabilities({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "not-a-paystack-key",
        PAYSTACK_MOBILE_MONEY_ENABLED: "true",
      }).mobileMoney,
    ).toBe("unavailable");
  });
});
