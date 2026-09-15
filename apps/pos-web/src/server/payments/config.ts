import { SERVER_ONLY_CONFIG_NAMES, SERVER_ONLY_SECRET_NAMES } from "../../config/secrets";

const PAYMENT_SECRET_NAMES = [
  "PAYSTACK_SECRET_KEY",
  "PAYMENT_SECRET_KEY",
  "PAYMENT_WEBHOOK_SECRET",
  "PAYSTACK_TEST_PAYER_EMAIL",
] as const;

const PAYMENT_CONFIG_NAMES = ["PAYMENT_PROVIDER", "PAYSTACK_MODE"] as const;

export type PaymentProviderConfig =
  | { readonly kind: "disabled" }
  | {
      readonly kind: "paystack_test";
      readonly secretKey: string;
      readonly sandboxPayerEmail?: string;
    }
  | { readonly kind: "blocked_live" };

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
  if (mode === "live" || secretKey.startsWith("sk_live_")) {
    return { kind: "blocked_live" };
  }
  if (mode !== "test") {
    return { kind: "blocked_live" };
  }
  if (!secretKey || isUnusableCredential(secretKey)) {
    return { kind: "disabled" };
  }
  if (secretKey.startsWith("sk_live_")) {
    return { kind: "blocked_live" };
  }
  const sandboxPayerEmail = (env.PAYSTACK_TEST_PAYER_EMAIL ?? "").trim();
  return {
    kind: "paystack_test",
    secretKey,
    sandboxPayerEmail: sandboxPayerEmail && !isUnusableCredential(sandboxPayerEmail) ? sandboxPayerEmail : undefined,
  };
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
