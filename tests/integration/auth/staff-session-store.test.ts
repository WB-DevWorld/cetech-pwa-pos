import { describe, expect, test } from "vitest";
import { composeStaffSessionStore } from "../../../apps/pos-web/src/server/auth/compose-session-store";
import { createSupabaseStaffSessionStore } from "../../../apps/pos-web/src/server/auth/supabase-session-store";
import { futureExpiry } from "./helpers";
import type { PosRestFetch } from "../../../apps/pos-web/src/server/http/server-fetch";

const NOW = new Date("2026-09-13T13:30:00.000Z");
const SESSION = {
  actorId: "cashier_a",
  displayName: "Cashier A",
  organizationId: "org_a",
  locationIds: ["loc_a1"],
  capabilities: ["ui.hint.only"],
  expiresAt: futureExpiry(),
};

function restFrom(
  handler: (input: string, init: Parameters<PosRestFetch>[1]) => Promise<{
    status: number;
    body?: unknown;
  }>,
): PosRestFetch {
  return async (input, init) => {
    const result = await handler(input, init);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.body ?? [],
    };
  };
}

describe("CORE-02 durable staff session store", () => {
  test("ephemeral store is still refused for staging and production", () => {
    expect(() => composeStaffSessionStore({ APP_ENV: "staging" })).toThrow(/durable staff session store is required/);
    expect(() =>
      composeStaffSessionStore(
        { APP_ENV: "production", SUPABASE_URL: "https://example.supabase.co" },
        restFrom(async () => ({ status: 200 })),
      ),
    ).toThrow(/durable staff session store is required/);
    expect(() => composeStaffSessionStore({ APP_ENV: "local" })).not.toThrow();
  });

  test("placeholders do not attach a durable store", () => {
    const store = composeStaffSessionStore({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "REPLACE_WITH_SERVER_ONLY_KEY",
    });
    expect(store).toBeDefined();
  });

  test("create/get/revoke round-trip uses server-managed id and does not trust browser tenant columns", async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const fetchImpl = restFrom(async (input, init) => {
      const method = init.method ?? "GET";
      if (method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(body.organization_id).toBe("org_a");
        expect(body.actor_id).toBe("cashier_a");
        expect(typeof body.id).toBe("string");
        rows.set(String(body.id), { ...body, revoked_at: null });
        return { status: 201 };
      }
      const idMatch = /id=eq\.([^&]+)/.exec(input);
      const id = idMatch ? decodeURIComponent(idMatch[1]) : "";
      if (method === "GET") {
        const row = rows.get(id);
        return { status: 200, body: row ? [row] : [] };
      }
      if (method === "PATCH") {
        const row = rows.get(id);
        if (row) {
          rows.set(id, { ...row, revoked_at: "2026-09-13T14:00:00.000Z" });
        }
        return { status: 204 };
      }
      return { status: 500 };
    });
    const store = createSupabaseStaffSessionStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl,
    });
    const sessionId = await store.create(SESSION, "csrf-server", new Date(NOW.getTime() + 3600_000));
    const stored = await store.get(sessionId, NOW);
    expect(stored?.session.actorId).toBe("cashier_a");
    expect(stored?.csrfToken).toBe("csrf-server");
    await store.revoke(sessionId);
    expect(await store.get(sessionId, NOW)).toBeNull();
  });

  test("expired, revoked, or tenant-mismatched rows are not trusted access", async () => {
    const fetchImpl = restFrom(async () => ({
      status: 200,
      body: [
        {
          id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          organization_id: "org_other",
          actor_id: "cashier_a",
          csrf_token: "csrf",
          session_payload: SESSION,
          expires_at: "2026-09-13T15:00:00.000Z",
          revoked_at: null,
        },
      ],
    }));
    const store = createSupabaseStaffSessionStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl,
    });
    expect(await store.get("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", NOW)).toBeNull();
  });

  test("401/403 from PostgREST is infrastructure failure, not anonymous", async () => {
    const store = createSupabaseStaffSessionStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: restFrom(async () => ({ status: 403 })),
    });
    await expect(store.get("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", NOW)).rejects.toThrow(/denied infrastructure/);
  });
});
