import { SERVER_ONLY_CONFIG_NAMES, SERVER_ONLY_SECRET_NAMES } from "../../config/secrets";

const PAYMENT_SECRET_NAMES = [
  "PAYSTACK_SECRET_KEY",
  "PAYMENT_SECRET_KEY",
  "PAYMENT_WEBHOOK_SECRET",
  "PAYSTACK_TEST_PAYER_EMAIL",
] as const;

const PAYMENT_CONFIG_NAMES = [
  "PAYMENT_PROVIDER",
  "PAYSTACK_MODE",
  "PAYSTACK_MOBILE_MONEY_ENABLED",
  "PAYSTACK_CARD_ENABLED",
] as const;

export type PaymentProviderConfig =
  | { readonly kind: "disabled" }
  | {
      readonly kind: "paystack_test";
      readonly secretKey: string;
      readonly sandboxPayerEmail?: string;
    }
  | { readonly kind: "blocked_live" }
  | { readonly kind: "blocked_unsafe" };

export function isPaystackTestSecret(secret: string): boolean {
  return secret.startsWith("sk_test_");
}

export function readPaymentProviderConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PaymentProviderConfig {
  rejectPublicPaymentSecrets(env);
  const provider = (env.PAYMENT_PROVIDER ?? "disabled").trim().toLowerCase();
  if (!provider || provider === "disabled") {
    return { kind: "disabled" };
  }
  if (provider !== "paystack") {
    return { kind: "disabled" };
  }
  const mode = (env.PAYSTACK_MODE ?? env.PAYMENT_MODE ?? "test").trim().toLowerCase();
  const secretKey = (env.PAYSTACK_SECRET_KEY ?? env.PAYMENT_SECRET_KEY ?? "").trim();
  if (mode === "live") {
    return { kind: "blocked_live" };
  }
  if (secretKey.startsWith("sk_live_")) {
    return { kind: "blocked_live" };
  }
  if (mode !== "test") {
    return { kind: "blocked_live" };
  }
  if (!secretKey || isUnusableCredential(secretKey)) {
    return { kind: "disabled" };
  }
  if (!isPaystackTestSecret(secretKey)) {
    return { kind: "blocked_unsafe" };
  }
  const sandboxPayerEmail = (env.PAYSTACK_TEST_PAYER_EMAIL ?? "").trim();
  return {
    kind: "paystack_test",
    secretKey,
    sandboxPayerEmail: isUsableSandboxPayerEmail(sandboxPayerEmail) ? sandboxPayerEmail : undefined,
  };
}

/** Empty mode matches the resolver default of test. A non-empty invalid mode does not. */
export function paystackModeSelection(
  env: Readonly<Record<string, string | undefined>>,
): { readonly mode: "test" | "live" | "other"; readonly defaulted: boolean } {
  const raw = (env.PAYSTACK_MODE ?? env.PAYMENT_MODE ?? "").trim().toLowerCase();
  if (!raw) return { mode: "test", defaulted: true };
  if (raw === "test" || raw === "live") return { mode: raw, defaulted: false };
  return { mode: "other", defaulted: false };
}

/** A placeholder or a non-email is not a payer the test checkout can use. */
export function isUsableSandboxPayerEmail(value: string | undefined): boolean {
  const payer = value?.trim() ?? "";
  if (!payer || isUnusableCredential(payer)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payer);
}

export function rejectPublicPaymentSecrets(env: Readonly<Record<string, string | undefined>>): void {
  for (const name of [...SERVER_ONLY_SECRET_NAMES, ...SERVER_ONLY_CONFIG_NAMES, ...PAYMENT_SECRET_NAMES, ...PAYMENT_CONFIG_NAMES]) {
    if (env[`NEXT_PUBLIC_${name}`]) {
      throw new Error("privileged server secret must not be exposed as public environment");
    }
  }
}

function isUnusableCredential(value: string): boolean {
  const upper = value.toUpperCase();
  return (
    upper.startsWith("REPLACE_WITH") ||
    upper.includes("PLACEHOLDER") ||
    upper === "CHANGE_ME" ||
    upper.includes("NOT_A_REAL")
  );
}
