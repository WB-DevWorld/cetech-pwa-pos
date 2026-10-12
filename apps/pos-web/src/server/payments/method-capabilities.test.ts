import { describe, expect, test } from "vitest";
import {
  capabilityForElectronicTender,
  coercePaymentMethodCapabilities,
  diagnosePaymentConfiguration,
  resolvePaymentMethodCapabilities,
} from "./method-capabilities";

describe("payment method capabilities", () => {
  test("disabled provider leaves electronic methods unconfigured", () => {
    expect(resolvePaymentMethodCapabilities({ PAYMENT_PROVIDER: "disabled" })).toEqual({
      cash: "available",
      mobileMoney: "unconfigured",
      card: "unconfigured",
      externalTerminal: "unconfigured",
      manualMobileMoney: "not_set_up",
      integratedCheckout: "not_set_up",
      configurationReason: "provider_disabled",
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
      manualMobileMoney: "not_set_up",
      integratedCheckout: "not_verified",
      configurationReason: "channel_disabled",
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
    expect(
      resolvePaymentMethodCapabilities({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "live",
        PAYSTACK_SECRET_KEY: "sk_live_example",
      }).integratedCheckout,
    ).toBe("live_blocked");
    expect(
      diagnosePaymentConfiguration({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "sk_test_example_key",
        PAYSTACK_CARD_ENABLED: "true",
        PAYSTACK_TEST_PAYER_EMAIL: "payer@example.test",
      }).reason,
    ).toBe("test_channels_configured");
    expect(
      diagnosePaymentConfiguration({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "sk_test_example_key",
        PAYSTACK_CARD_ENABLED: "true",
        PAYSTACK_TEST_PAYER_EMAIL: "payer@example.test",
      }, { customerPresentationImplemented: false }).reason,
    ).toBe("customer_presentation_missing");
    expect(
      diagnosePaymentConfiguration({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_SECRET_KEY: "sk_test_example_key",
        PAYSTACK_CARD_ENABLED: "true",
        PAYSTACK_TEST_PAYER_EMAIL: "payer@example.test",
      }).modeDefaulted,
    ).toBe(true);
    expect(
      diagnosePaymentConfiguration({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "sk_test_example_key",
        PAYSTACK_CARD_ENABLED: "true",
        PAYSTACK_TEST_PAYER_EMAIL: "not-an-email",
      }).reason,
    ).toBe("payer_missing");
    const legacy = coercePaymentMethodCapabilities({
      cash: "available",
      mobileMoney: "configured",
      card: "configured",
      externalTerminal: "unconfigured",
    });
    expect(legacy?.manualMobileMoney).toBe("not_set_up");
    expect(legacy?.integratedCheckout).toBe("not_verified");
    expect(
      resolvePaymentMethodCapabilities({
        PAYMENT_PROVIDER: "disabled",
        MANUAL_MOBILE_MONEY_ENABLED: "true",
        MANUAL_MOBILE_MONEY_NETWORK: "MTN",
        MANUAL_MOBILE_MONEY_ACCOUNT_LABEL: "Shop till",
      }).manualMobileMoney,
    ).toBe("enabled");
    expect(JSON.stringify(diagnosePaymentConfiguration({
      PAYMENT_PROVIDER: "paystack",
      PAYSTACK_SECRET_KEY: "sk_test_example_key",
    }))).not.toContain("sk_test");
  });
});
