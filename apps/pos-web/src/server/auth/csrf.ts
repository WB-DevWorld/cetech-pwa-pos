import { STAFF_CSRF_COOKIE, STAFF_CSRF_HEADER } from "../../config/auth";

export type MutationProtectionInput = {
  readonly origin: string | null;
  readonly referer: string | null;
  readonly csrfCookie: string | null;
  readonly csrfHeader: string | null;
  readonly allowedOrigins: readonly string[];
};

export type MutationProtectionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "origin" | "csrf" };

export function originFromReferer(referer: string | null): string | null {
  if (!referer) {
    return null;
  }
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function assertMutationProtection(input: MutationProtectionInput): MutationProtectionResult {
  const origin = input.origin ?? originFromReferer(input.referer);
  if (!origin || !input.allowedOrigins.includes(origin)) {
    return { ok: false, reason: "origin" };
  }
  if (!input.csrfCookie || !input.csrfHeader || input.csrfCookie !== input.csrfHeader) {
    return { ok: false, reason: "csrf" };
  }
  return { ok: true };
}

export function readCsrfHeader(headers: Readonly<Record<string, string | undefined>>): string | null {
  return headers[STAFF_CSRF_HEADER] ?? headers[STAFF_CSRF_HEADER.toUpperCase()] ?? null;
}

export function readCsrfCookie(cookies: Readonly<Record<string, string | undefined>>): string | null {
  return cookies[STAFF_CSRF_COOKIE] ?? null;
}
