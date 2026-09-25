import { INVITE_ACCEPT_PATH } from "../../config/auth";

/**
 * Trusted staff-invitation redirect.
 * Session origin resolution may fall back to localhost or a Vercel deployment
 * URL. Invitation links must not. The destination is server configuration only.
 */

export type InvitationRedirect =
  | { readonly ok: true; readonly origin: string; readonly redirectTo: string }
  | {
      readonly ok: false;
      readonly reason: "missing" | "malformed" | "localhost_prohibited" | "insecure";
    };

export function resolveInvitationRedirect(
  env: Readonly<Record<string, string | undefined>>,
): InvitationRedirect {
  const explicit = env.APP_ORIGIN?.trim() || env.NEXT_PUBLIC_APP_ORIGIN?.trim() || "";
  if (!explicit) {
    if (invitationMode(env) === "local") {
      return accepted("http://localhost:3000");
    }
    return { ok: false, reason: "missing" };
  }

  const parsed = parseOrigin(explicit);
  if (!parsed) {
    return { ok: false, reason: "malformed" };
  }
  const loopback = isLoopback(parsed.hostname);
  if (invitationMode(env) === "deployed") {
    if (loopback) {
      return { ok: false, reason: "localhost_prohibited" };
    }
    if (parsed.protocol !== "https:") {
      return { ok: false, reason: "insecure" };
    }
  } else if (parsed.protocol !== "https:" && !loopback) {
    return { ok: false, reason: "insecure" };
  }
  return accepted(parsed.origin);
}

function accepted(origin: string): InvitationRedirect {
  return { ok: true, origin, redirectTo: `${origin}${INVITE_ACCEPT_PATH}` };
}

function invitationMode(env: Readonly<Record<string, string | undefined>>): "local" | "deployed" {
  const app = env.APP_ENV?.trim() ?? "";
  if (app === "staging" || app === "production") {
    return "deployed";
  }
  const vercel = env.VERCEL_ENV?.trim();
  if (vercel === "preview" || vercel === "production") {
    return "deployed";
  }
  return "local";
}

function parseOrigin(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (!url.hostname || url.pathname !== "/" || url.search || url.hash) {
    return null;
  }
  return url;
}

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}
