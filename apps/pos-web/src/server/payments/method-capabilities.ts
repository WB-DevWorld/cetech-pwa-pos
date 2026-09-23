import { readPaymentProviderConfig } from "./config";

export type PaymentMethodCapability = "available" | "configured" | "unconfigured" | "unavailable";

/**
 * Method-specific payment readiness. Cash is a POS tender.
 * Paystack test configuration enables only the channels that provider supports:
 * card and mobile money. External terminals are a separate capability.
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
      mobileMoney: "configured",
      card: "configured",
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

function isCapability(value: unknown): value is PaymentMethodCapability {
  return value === "available" || value === "configured" || value === "unconfigured" || value === "unavailable";
}
