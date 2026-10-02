import type { ElectronicTender } from "../../../../../docs/contracts/domain.generated";
import { readPaymentProviderConfig } from "./config";

export type PaymentMethodCapability = "available" | "configured" | "unconfigured" | "unavailable";

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
};

export function resolvePaymentMethodCapabilities(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PaymentMethodCapabilities {
  const config = readPaymentProviderConfig(env);
  if (config.kind === "paystack_test") {
    return {
      cash: "available",
      mobileMoney: explicitlyEnabled(env.PAYSTACK_MOBILE_MONEY_ENABLED)
        ? "configured"
        : "unconfigured",
      card: explicitlyEnabled(env.PAYSTACK_CARD_ENABLED)
        ? "configured"
        : "unconfigured",
      externalTerminal: "unconfigured",
    };
  }
  if (config.kind === "blocked_live" || config.kind === "blocked_unsafe") {
    return {
      cash: "available",
      mobileMoney: "unavailable",
      card: "unavailable",
      externalTerminal: "unavailable",
    };
  }
  return {
    cash: "available",
    mobileMoney: "unconfigured",
    card: "unconfigured",
    externalTerminal: "unconfigured",
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
    isCapability(row.externalTerminal)
  );
}

function explicitlyEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function isCapability(value: unknown): value is PaymentMethodCapability {
  return value === "available" || value === "configured" || value === "unconfigured" || value === "unavailable";
}
