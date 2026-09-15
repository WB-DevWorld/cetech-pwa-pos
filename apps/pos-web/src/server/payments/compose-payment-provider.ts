import { readPaymentProviderConfig } from "./config";
import { createPaystackElectronicPaymentProvider } from "./paystack-provider";
import type { ElectronicPaymentProvider } from "./provider";

export type ComposedPaymentProvider =
  | { readonly kind: "disabled"; readonly provider?: undefined }
  | { readonly kind: "blocked_live"; readonly provider?: undefined }
  | { readonly kind: "ready"; readonly provider: ElectronicPaymentProvider; readonly sandboxPayerEmail?: string };

export function composeElectronicPaymentProvider(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ComposedPaymentProvider {
  const config = readPaymentProviderConfig(env);
  if (config.kind === "blocked_live") {
    return { kind: "blocked_live" };
  }
  if (config.kind === "disabled") {
    return { kind: "disabled" };
  }
  return {
    kind: "ready",
    provider: createPaystackElectronicPaymentProvider({ secretKey: config.secretKey }),
    sandboxPayerEmail: config.sandboxPayerEmail,
  };
}
