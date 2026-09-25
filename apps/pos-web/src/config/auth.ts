export const STAFF_SESSION_COOKIE = "cetech_pos_sid";
export const STAFF_CSRF_COOKIE = "cetech_pos_csrf";
export const STAFF_CSRF_HEADER = "x-csrf-token";
/** Supabase invite links land here. The token is read in the browser, then removed. */
export const INVITE_ACCEPT_PATH = "/auth/invite";

export type AuthCookieOptions = {
  readonly secure: boolean;
  readonly sameSite: "Lax";
  readonly path: "/";
  readonly httpOnlySession: true;
};

export const AUTH_COOKIE_OPTIONS: AuthCookieOptions = {
  secure: true,
  sameSite: "Lax",
  path: "/",
  httpOnlySession: true,
};

export function parseAllowedOrigins(value: string | undefined): readonly string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
