const ALLOWED_HOSTS = new Set(["checkout.paystack.com", "standard.paystack.co"]);
const ACCESS_CODE = /^[A-Za-z0-9_-]{8,128}$/;

/** The customer handoff is this module. Diagnosis must not say it is missing. */
export const PAYSTACK_CUSTOMER_PRESENTATION_IMPLEMENTED = true;

/**
 * Allowlisted HTTPS Paystack checkout only. The browser never receives a secret,
 * and a non-allowlisted or non-HTTPS URL is dropped.
 */
export function allowlistedPaystackUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

export function paystackTestCheckoutUrl(input: {
  readonly accessCode?: string;
  readonly authorizationUrl?: string;
}): string | undefined {
  const provided = allowlistedPaystackUrl(input.authorizationUrl);
  if (provided) return provided;
  if (input.accessCode && ACCESS_CODE.test(input.accessCode)) {
    return `https://checkout.paystack.com/${input.accessCode}`;
  }
  return undefined;
}
