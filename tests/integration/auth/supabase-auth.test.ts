import { describe, expect, test } from "vitest";
import { createStaffIdentityVerifier } from "../../../apps/pos-web/src/server/auth/identity-verifier";
import { createEphemeralInMemoryStaffSessionStore } from "../../../apps/pos-web/src/server/auth/session-store";
import { establishStaffSession, revokeStaffSession } from "../../../apps/pos-web/src/server/auth/staff-session";
import {
  createSupabaseAuthIntrospector,
  credentialLooksLikeServiceRole,
  mapSupabaseUserToStaffClaims,
} from "../../../apps/pos-web/src/server/auth/supabase-auth";
import { CORRELATION, futureExpiry } from "./helpers";

function unsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

const publishableKey = unsignedJwt({ role: "anon", iss: "https://example.supabase.co/auth/v1" });
const staffAccessToken = unsignedJwt({
  role: "authenticated",
  exp: Math.floor(Date.now() / 1000) + 3600,
  sub: "00000000-0000-4000-8000-000000000001",
});
const expiredAccessToken = unsignedJwt({
  role: "authenticated",
  exp: Math.floor(Date.now() / 1000) - 60,
  sub: "00000000-0000-4000-8000-000000000001",
});
const serviceRoleKey = unsignedJwt({ role: "service_role" });

const staffUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "cashier.a@example.test",
  app_metadata: {
    actor_id: "cashier_a",
    organization_id: "org_a",
    location_ids: ["loc_a1"],
    register_id: "reg_a",
  },
  user_metadata: { display_name: "Cashier A" },
};

describe("CORE-02 Supabase Auth adapter", () => {
  test("service-role credentials cannot be used as staff authorization", () => {
    expect(credentialLooksLikeServiceRole(serviceRoleKey)).toBe(true);
    expect(credentialLooksLikeServiceRole(publishableKey)).toBe(false);
    expect(() =>
      createSupabaseAuthIntrospector({
        supabaseUrl: "https://example.supabase.co",
        publishableKey: serviceRoleKey,
      }),
    ).toThrow(/service-role credential must not be used/);
  });

  test("maps trusted Auth user metadata and refuses buyer identity", () => {
    const claims = mapSupabaseUserToStaffClaims(staffUser, staffAccessToken);
    expect(claims?.actorId).toBe("cashier_a");
    expect(claims?.organizationId).toBe("org_a");
    expect(
      mapSupabaseUserToStaffClaims(
        {
          ...staffUser,
          app_metadata: { customer_id: "cust_a", organization_id: "org_a", location_ids: ["loc_a1"] },
        },
        staffAccessToken,
      ),
    ).toBeNull();
  });

  test("Auth 401 expired token is not trusted access", async () => {
    const introspector = createSupabaseAuthIntrospector({
      supabaseUrl: "https://example.supabase.co",
      publishableKey,
      async fetchImpl() {
        return { ok: false, status: 401, async json() { return { message: "invalid" }; } };
      },
    });
    const verifier = createStaffIdentityVerifier(introspector);
    const result = await verifier.verify({ accessToken: expiredAccessToken, now: new Date() });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("expired");
    }
  });

  test("Auth timeout/unavailable does not become trusted access", async () => {
    const timeout = createSupabaseAuthIntrospector({
      supabaseUrl: "https://example.supabase.co",
      publishableKey,
      async fetchImpl() {
        const error = new Error("aborted");
        error.name = "TimeoutError";
        throw error;
      },
    });
    expect(await timeout.introspect(staffAccessToken, new Date())).toEqual({ status: "timeout" });

    const down = createSupabaseAuthIntrospector({
      supabaseUrl: "https://example.supabase.co",
      publishableKey,
      async fetchImpl() {
        return { ok: false, status: 503, async json() { return {}; } };
      },
    });
    expect(await down.introspect(staffAccessToken, new Date())).toEqual({ status: "unavailable" });
  });

  test("establishStaffSession sets HttpOnly session cookie and revoke does not require IndexedDB", async () => {
    const introspector = createSupabaseAuthIntrospector({
      supabaseUrl: "https://example.supabase.co",
      publishableKey,
      async fetchImpl() {
        return { ok: true, status: 200, async json() { return staffUser; } };
      },
    });
    const store = createEphemeralInMemoryStaffSessionStore();
    const established = await establishStaffSession({
      accessToken: staffAccessToken,
      now: new Date(),
      verifier: createStaffIdentityVerifier(introspector),
      store,
      correlationId: CORRELATION,
    });
    expect(established.ok).toBe(true);
    if (!established.ok) {
      throw new Error("expected session");
    }
    expect(established.data.session.actorId).toBe("cashier_a");
    expect(established.data.session.expiresAt <= futureExpiry(2)).toBe(true);
    expect(established.data.cookies.some((cookie) => cookie.includes("HttpOnly") && cookie.includes("Secure"))).toBe(
      true,
    );
    expect(established.data.cookies.some((cookie) => cookie.includes("cetech_pos_csrf") && !cookie.includes("HttpOnly"))).toBe(
      true,
    );
    const stored = await store.get(established.data.sessionId, new Date());
    expect(stored?.session.actorId).toBe("cashier_a");

    const revoked = await revokeStaffSession({
      cookieHeader: `cetech_pos_sid=${established.data.sessionId}`,
      store,
      now: new Date(),
      correlationId: CORRELATION,
    });
    expect(await store.get(established.data.sessionId, new Date())).toBeNull();
    expect(revoked.cookies.join(" ")).toContain("cetech_pos_sid=");
  });
});
