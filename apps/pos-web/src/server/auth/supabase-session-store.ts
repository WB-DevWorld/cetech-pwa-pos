import { parseSession } from "./claims";
import { isUuid } from "./ids";
import type { StaffSessionStore, StoredStaffSession } from "./session-store";
import type { PosRestFetch } from "../http/server-fetch";

export type SupabaseStaffSessionStoreOptions = {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Durable StaffSessionStore backed by POS-owned `pos_staff_sessions`.
 * The service-role key is infrastructure access for PostgREST, not cashier
 * authorization and not a browser credential.
 */
export function createSupabaseStaffSessionStore(
  options: SupabaseStaffSessionStoreOptions,
): StaffSessionStore {
  const base = `${options.url.replace(/\/+$/, "")}/rest/v1/pos_staff_sessions`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = infrastructureHeaders(options.serviceRoleKey);

  return {
    async create(session, csrfToken, expiresAt, flags) {
      const sessionId = crypto.randomUUID();
      const response = await options.fetchImpl(base, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          id: sessionId,
          organization_id: session.organizationId,
          actor_id: session.actorId,
          csrf_token: csrfToken,
          session_payload: {
            ...session,
            ...(flags?.mustChangePassword === true ? { mustChangePassword: true } : {}),
            ...(flags?.authUserId ? { authUserId: flags.authUserId } : {}),
          },
          expires_at: expiresAt.toISOString(),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status !== 201 && response.status !== 200) {
        throw new Error("staff session store rejected create");
      }
      return sessionId;
    },
    async get(sessionId, now) {
      if (!isUuid(sessionId)) {
        return null;
      }
      const url = `${base}?id=eq.${encodeURIComponent(sessionId)}&select=id,organization_id,actor_id,csrf_token,session_payload,expires_at,revoked_at`;
      const response = await options.fetchImpl(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error("staff session store denied infrastructure access");
      }
      if (!response.ok) {
        throw new Error("staff session store is unavailable");
      }
      const rows = await response.json();
      return parseStoredRow(rows, now);
    },
    async revoke(sessionId) {
      if (!isUuid(sessionId)) {
        return;
      }
      const url = `${base}?id=eq.${encodeURIComponent(sessionId)}`;
      const response = await options.fetchImpl(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error("staff session store denied infrastructure access");
      }
      if (!response.ok && response.status !== 404) {
        throw new Error("staff session store is unavailable");
      }
    },
    async revokeActorSessions(input) {
      const url =
        `${base}?organization_id=eq.${encodeURIComponent(input.organizationId)}` +
        `&actor_id=eq.${encodeURIComponent(input.actorId)}&revoked_at=is.null`;
      const response = await options.fetchImpl(url, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error("staff session store denied infrastructure access");
      }
      if (!response.ok && response.status !== 404) {
        throw new Error("staff session store is unavailable");
      }
    },
  };
}

function infrastructureHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function parseStoredRow(rows: unknown, now: Date): StoredStaffSession | null {
  if (!Array.isArray(rows) || rows.length !== 1) {
    return null;
  }
  const row = rows[0];
  if (row === null || typeof row !== "object") {
    return null;
  }
  const data = row as Record<string, unknown>;
  if (data.revoked_at !== null && data.revoked_at !== undefined) {
    return null;
  }
  const expiresAtRaw = data.expires_at;
  if (typeof expiresAtRaw !== "string") {
    return null;
  }
  const expiresAt = new Date(expiresAtRaw);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
    return null;
  }
  const session = parseSession(data.session_payload);
  if (!session) {
    return null;
  }
  const payload = data.session_payload;
  const payloadRecord =
    payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
  const mustChangePassword = payloadRecord.mustChangePassword === true;
  const authUserId = typeof payloadRecord.authUserId === "string" ? payloadRecord.authUserId : null;
  if (session.organizationId !== data.organization_id || session.actorId !== data.actor_id) {
    return null;
  }
  if (typeof data.csrf_token !== "string" || data.csrf_token.length < 1) {
    return null;
  }
  return { session, csrfToken: data.csrf_token, expiresAt, mustChangePassword, authUserId };
}
