import { AUTH_COOKIE_OPTIONS, STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) {
    return out;
  }
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 1) {
      continue;
    }
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (name.length > 0) {
      out[name] = value;
    }
  }
  return out;
}

export function sessionSetCookie(sessionId: string, expiresAt: Date, secure = AUTH_COOKIE_OPTIONS.secure): string {
  return [
    `${STAFF_SESSION_COOKIE}=${sessionId}`,
    "HttpOnly",
    secure ? "Secure" : null,
    `SameSite=${AUTH_COOKIE_OPTIONS.sameSite}`,
    `Path=${AUTH_COOKIE_OPTIONS.path}`,
    `Expires=${expiresAt.toUTCString()}`,
  ]
    .filter((item): item is string => item !== null)
    .join("; ");
}

export function csrfSetCookie(csrfToken: string, expiresAt: Date, secure = AUTH_COOKIE_OPTIONS.secure): string {
  return [
    `${STAFF_CSRF_COOKIE}=${csrfToken}`,
    secure ? "Secure" : null,
    `SameSite=${AUTH_COOKIE_OPTIONS.sameSite}`,
    `Path=${AUTH_COOKIE_OPTIONS.path}`,
    `Expires=${expiresAt.toUTCString()}`,
  ]
    .filter((item): item is string => item !== null)
    .join("; ");
}

export function sessionClearCookie(secure = AUTH_COOKIE_OPTIONS.secure): string {
  return sessionSetCookie("", new Date(0), secure);
}

export function csrfClearCookie(secure = AUTH_COOKIE_OPTIONS.secure): string {
  return csrfSetCookie("", new Date(0), secure);
}

/** Staging/production always Secure. Local HTTP origins omit Secure so the cookie can be stored. */
export function staffCookieSecure(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const appEnv = env.APP_ENV ?? "local";
  if (appEnv === "production" || appEnv === "staging") {
    return true;
  }
  const origin = env.APP_ORIGIN ?? env.NEXT_PUBLIC_APP_ORIGIN ?? "";
  return origin.startsWith("https://");
}
