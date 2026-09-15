const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Paystack requires an email at initialize. Frozen InitializePaymentRequest has
 * no browser email. Production must fail closed without trusted server-side
 * customer/order contact. Local/staging may use a server-only synthetic fixture.
 */
export function sandboxPayerEmail(input: {
  readonly appEnv: string;
  readonly configuredEmail?: string;
}): { readonly email: string; readonly source: "SANDBOX_FIXTURE_ONLY" } | null {
  if (input.appEnv === "production") {
    return null;
  }
  const email = input.configuredEmail?.trim() ?? "";
  if (!EMAIL.test(email)) {
    return null;
  }
  return { email, source: "SANDBOX_FIXTURE_ONLY" };
}
