import type { ElectronicTender } from "../../../../../docs/contracts/domain.generated";
import { readPaymentProviderConfig } from "./config";

export type PaymentMethodCapability = "available" | "configured" | "unconfigured" | "unavailable";

export type ManualMobileMoneyPresentation = "enabled" | "not_set_up";

export type IntegratedCheckoutPresentation =
  | "not_set_up"
  | "paystack_test"
  | "live_blocked"
  | "unavailable"
  | "not_verified";

/**
 * Operator-facing reason. Never includes secret values.
 * Customer Paystack presentation is still a separate source gap until the
 * handoff port exists, so test credentials alone are not checkout-ready.
 */
export type PaymentConfigurationReason =
  | "provider_disabled"
  | "credential_missing"
  | "credential_unsafe"
  | "live_blocked"
  | "channel_disabled"
  | "payer_missing"
  | "customer_presentation_missing"
  | "test_channels_configured";

/**
 * Method-specific payment readiness. Cash is a POS tender.
 *
 * A provider credential is necessary but not sufficient to enable a payment
 * method. Each electronic method must also be explicitly enabled in server
 * configuration for the current environment. This prevents one provider from
 * implicitly advertising every channel it happens to support.
 *
 * This object never includes secrets.
 */
export type PaymentMethodCapabilities = {
  readonly cash: "available";
  readonly mobileMoney: PaymentMethodCapability;
  readonly card: PaymentMethodCapability;
  readonly externalTerminal: PaymentMethodCapability;
  readonly manualMobileMoney: ManualMobileMoneyPresentation;
  readonly integratedCheckout: IntegratedCheckoutPresentation;
  readonly configurationReason: PaymentConfigurationReason;
};

export function resolvePaymentMethodCapabilities(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PaymentMethodCapabilities {
  const diagnosis = diagnosePaymentConfiguration(env);
  const config = readPaymentProviderConfig(env);
  const manualMobileMoney: ManualMobileMoneyPresentation = "not_set_up";
  if (config.kind === "paystack_test") {
    return {
      cash: "available",
      mobileMoney: explicitlyEnabled(env.PAYSTACK_MOBILE_MONEY_ENABLED) ? "configured" : "unconfigured",
      card: explicitlyEnabled(env.PAYSTACK_CARD_ENABLED) ? "configured" : "unconfigured",
      externalTerminal: "unconfigured",
      manualMobileMoney,
      integratedCheckout: "paystack_test",
      configurationReason: diagnosis.reason,
    };
  }
  if (config.kind === "blocked_live") {
    return {
      cash: "available",
      mobileMoney: "unavailable",
      card: "unavailable",
      externalTerminal: "unavailable",
      manualMobileMoney,
      integratedCheckout: "live_blocked",
      configurationReason: "live_blocked",
    };
  }
  if (config.kind === "blocked_unsafe") {
    return {
      cash: "available",
      mobileMoney: "unavailable",
      card: "unavailable",
      externalTerminal: "unavailable",
      manualMobileMoney,
      integratedCheckout: "unavailable",
      configurationReason: "credential_unsafe",
    };
  }
  return {
    cash: "available",
    mobileMoney: "unconfigured",
    card: "unconfigured",
    externalTerminal: "unconfigured",
    manualMobileMoney,
    integratedCheckout: "not_set_up",
    configurationReason: diagnosis.reason,
  };
}

export type PaymentConfigurationDiagnosis = {
  readonly providerEnabled: boolean;
  readonly mode: "unset" | "test" | "live" | "other";
  readonly secretPresent: boolean;
  readonly secretClass: "absent" | "test" | "live" | "unsafe" | "placeholder";
  readonly cardEnabled: boolean;
  readonly mobileMoneyEnabled: boolean;
  readonly payerPresent: boolean;
  readonly customerPresentationImplemented: false;
  readonly reason: PaymentConfigurationReason;
};

export function diagnosePaymentConfiguration(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PaymentConfigurationDiagnosis {
  const provider = (env.PAYMENT_PROVIDER ?? "disabled").trim().toLowerCase();
  const modeRaw = (env.PAYSTACK_MODE ?? env.PAYMENT_MODE ?? "").trim().toLowerCase();
  const mode = modeRaw === "test" || modeRaw === "live" ? modeRaw : modeRaw ? "other" : "unset";
  const secret = (env.PAYSTACK_SECRET_KEY ?? env.PAYMENT_SECRET_KEY ?? "").trim();
  const secretClass = classifySecret(secret);
  const cardEnabled = explicitlyEnabled(env.PAYSTACK_CARD_ENABLED);
  const mobileMoneyEnabled = explicitlyEnabled(env.PAYSTACK_MOBILE_MONEY_ENABLED);
  const payer = (env.PAYSTACK_TEST_PAYER_EMAIL ?? "").trim();
  const payerPresent = payer.length > 0 && !isPlaceholder(payer);
  const providerEnabled = provider === "paystack";
  let reason: PaymentConfigurationReason = "provider_disabled";
  if (!providerEnabled) reason = "provider_disabled";
  else if (mode === "live" || secretClass === "live") reason = "live_blocked";
  else if (secretClass === "absent" || secretClass === "placeholder") reason = "credential_missing";
  else if (secretClass === "unsafe" || mode !== "test") reason = "credential_unsafe";
  else if (!cardEnabled && !mobileMoneyEnabled) reason = "channel_disabled";
  else if (!payerPresent) reason = "payer_missing";
  else reason = "customer_presentation_missing";
  return {
    providerEnabled,
    mode,
    secretPresent: secretClass !== "absent",
    secretClass,
    cardEnabled,
    mobileMoneyEnabled,
    payerPresent,
    customerPresentationImplemented: false,
    reason,
  };
}

export function capabilityForElectronicTender(
  capabilities: PaymentMethodCapabilities,
  tender: ElectronicTender,
): PaymentMethodCapability {
  if (tender === "mobile_money") return capabilities.mobileMoney;
  if (tender === "card") return capabilities.card;
  return capabilities.externalTerminal;
}

export function isPaymentMethodCapabilities(value: unknown): value is PaymentMethodCapabilities {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    row.cash === "available" &&
    isCapability(row.mobileMoney) &&
    isCapability(row.card) &&
    isCapability(row.externalTerminal) &&
    (row.manualMobileMoney === "enabled" || row.manualMobileMoney === "not_set_up") &&
    isIntegratedCheckout(row.integratedCheckout) &&
    isConfigurationReason(row.configurationReason)
  );
}

function isPlaceholder(value: string): boolean {
  const upper = value.toUpperCase();
  return upper.startsWith("REPLACE_WITH") || upper.includes("PLACEHOLDER") || upper === "CHANGE_ME" || upper.includes("NOT_A_REAL");
}

function classifySecret(secret: string): PaymentConfigurationDiagnosis["secretClass"] {
  if (!secret) return "absent";
  if (isPlaceholder(secret)) return "placeholder";
  if (secret.startsWith("sk_live_")) return "live";
  if (secret.startsWith("sk_test_")) return "test";
  return "unsafe";
}

function isIntegratedCheckout(value: unknown): value is IntegratedCheckoutPresentation {
  return (
    value === "not_set_up" ||
    value === "paystack_test" ||
    value === "live_blocked" ||
    value === "unavailable" ||
    value === "not_verified"
  );
}

function isConfigurationReason(value: unknown): value is PaymentConfigurationReason {
  return (
    value === "provider_disabled" ||
    value === "credential_missing" ||
    value === "credential_unsafe" ||
    value === "live_blocked" ||
    value === "channel_disabled" ||
    value === "payer_missing" ||
    value === "customer_presentation_missing" ||
    value === "test_channels_configured"
  );
}

function explicitlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function isCapability(value: unknown): value is PaymentMethodCapability {
  return value === "available" || value === "configured" || value === "unconfigured" || value === "unavailable";
}
