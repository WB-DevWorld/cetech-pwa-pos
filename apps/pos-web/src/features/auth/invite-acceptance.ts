import { INVITE_ACCEPT_PATH } from "../../config/auth";

export const INVITE_INVALID_COPY =
  "This invitation is invalid or has expired. Ask a manager to send a new invitation.";

export const INVITE_PASSWORD_SAVED_COPY =
  "Password saved. Sign in to CETECH POS with your email and password.";

export const INVITE_PASSWORD_SHORT_COPY = "Enter a password of at least 8 characters.";

export type InviteCallback =
  | { readonly status: "ready"; readonly accessToken: string; readonly nextLocation: typeof INVITE_ACCEPT_PATH }
  | { readonly status: "invalid"; readonly nextLocation: typeof INVITE_ACCEPT_PATH };

/**
 * Read a synthetic or live Supabase invite callback. The returned location
 * never keeps the token. Callers must drop the token after password setup.
 */
export function consumeInviteCallback(hash: string, search: string): InviteCallback {
  const params = new URLSearchParams(stripHash(hash));
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const [key, value] of query) {
    if (!params.has(key)) {
      params.set(key, value);
    }
  }
  const error = params.get("error") ?? params.get("error_code");
  const type = params.get("type");
  const accessToken = params.get("access_token")?.trim() ?? "";
  if (error || type !== "invite" || !accessToken || /\s/.test(accessToken)) {
    return { status: "invalid", nextLocation: INVITE_ACCEPT_PATH };
  }
  return { status: "ready", accessToken, nextLocation: INVITE_ACCEPT_PATH };
}

export type InvitedPasswordResult = "saved" | "invalid" | "unavailable" | "short";

export async function completeInvitedPassword(input: {
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly accessToken: string;
  readonly password: string;
  readonly fetchImpl?: typeof fetch;
}): Promise<InvitedPasswordResult> {
  if (input.password.trim().length < 8) {
    return "short";
  }
  const endpoint = new URL("/auth/v1/user", input.supabaseUrl);
  try {
    const response = await (input.fetchImpl ?? fetch)(endpoint, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        apikey: input.publishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: input.password }),
    });
    if (response.ok) {
      return "saved";
    }
    if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 422) {
      return "invalid";
    }
    return "unavailable";
  } catch {
    return "unavailable";
  }
}

function stripHash(hash: string): string {
  return hash.startsWith("#") ? hash.slice(1) : hash;
}
