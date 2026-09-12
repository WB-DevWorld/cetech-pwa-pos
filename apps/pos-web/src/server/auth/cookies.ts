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
