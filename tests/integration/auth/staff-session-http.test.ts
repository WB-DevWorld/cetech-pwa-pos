import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { createStaffIdentityVerifier } from "../../../apps/pos-web/src/server/auth/identity-verifier";
import { createEphemeralInMemoryStaffSessionStore } from "../../../apps/pos-web/src/server/auth/session-store";
import {
  handleEstablishStaffSession,
  handleRevokeStaffSession,
} from "../../../apps/pos-web/src/server/auth/handle-staff-session";
import { CORRELATION, ORIGIN, cashierClaims } from "./helpers";

const NOW = new Date("2026-09-13T13:30:00.000Z");

function verifierOk() {
  return createStaffIdentityVerifier({
    async introspect() {
      return {
        status: "active",
        payload: {
          actor_id: cashierClaims().actorId,
          organization_id: cashierClaims().organizationId,
          location_ids: cashierClaims().locationIds,
          register_id: cashierClaims().registerId,
          display_name: cashierClaims().displayName,
          exp: Math.floor(NOW.getTime() / 1000) + 3600,
        },
      };
    },
  });
}

describe("CORE-02 staff session HTTP", () => {
  test("POST establishes HttpOnly session cookie from Bearer token; tenant is not taken from the body", async () => {
    const store = createEphemeralInMemoryStaffSessionStore();
    const result = await handleEstablishStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      authorizationHeader: "Bearer synthetic-staff-access-token",
      now: NOW,
      verifier: verifierOk(),
      store,
      allowedOrigins: [ORIGIN],
      secureCookies: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      throw new Error("expected session");
    }
    expect(result.body.data.actorId).toBe("cashier_a");
    expect(JSON.stringify(result.body)).not.toMatch(/SERVICE_ROLE/i);
    expect(result.cookies.some((cookie) => cookie.includes("cetech_pos_sid=") && cookie.includes("HttpOnly"))).toBe(
      true,
    );
    expect(result.cookies.some((cookie) => cookie.includes("cetech_pos_csrf=") && !cookie.includes("HttpOnly"))).toBe(
      true,
    );
  });

  test("anonymous POST is AUTH_REQUIRED", async () => {
    const result = await handleEstablishStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      now: NOW,
      verifier: verifierOk(),
      store: createEphemeralInMemoryStaffSessionStore(),
      allowedOrigins: [ORIGIN],
      secureCookies: true,
    });
    expect(result.status).toBe(401);
    expect(result.body.ok).toBe(false);
  });

  test("disallowed origin cannot establish or revoke a session", async () => {
    const established = await handleEstablishStaffSession({
      correlationIdHeader: CORRELATION,
      origin: "https://evil.example",
      referer: null,
      authorizationHeader: "Bearer synthetic-staff-access-token",
      now: NOW,
      verifier: verifierOk(),
      store: createEphemeralInMemoryStaffSessionStore(),
      allowedOrigins: [ORIGIN],
      secureCookies: true,
    });
    expect(established.status).toBe(403);
  });

  test("DELETE requires CSRF associated with the stored session and does not claim IndexedDB wipe", async () => {
    const store = createEphemeralInMemoryStaffSessionStore();
    const established = await handleEstablishStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      authorizationHeader: "Bearer synthetic-staff-access-token",
      now: NOW,
      verifier: verifierOk(),
      store,
      allowedOrigins: [ORIGIN],
      secureCookies: true,
    });
    expect(established.body.ok).toBe(true);
    const sessionCookie = established.cookies.find((cookie) => cookie.startsWith("cetech_pos_sid="));
    const csrfCookie = established.cookies.find((cookie) => cookie.startsWith("cetech_pos_csrf="));
    expect(sessionCookie).toBeDefined();
    expect(csrfCookie).toBeDefined();
    const sessionId = sessionCookie?.split(";")[0]?.split("=")[1] ?? "";
    const csrf = csrfCookie?.split(";")[0]?.split("=")[1] ?? "";

    const denied = await handleRevokeStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: `cetech_pos_sid=${sessionId}; cetech_pos_csrf=${csrf}`,
      csrfHeader: "wrong-csrf",
      now: NOW,
      store,
      allowedOrigins: [ORIGIN],
      secureCookies: true,
    });
    expect(denied.status).toBe(403);
    expect(await store.get(sessionId, NOW)).not.toBeNull();

    const revoked = await handleRevokeStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: `cetech_pos_sid=${sessionId}; cetech_pos_csrf=${csrf}`,
      csrfHeader: csrf,
      now: NOW,
      store,
      allowedOrigins: [ORIGIN],
      secureCookies: true,
    });
    expect(revoked.status).toBe(200);
    expect(revoked.body.ok).toBe(true);
    if (!revoked.body.ok) {
      throw new Error("expected sign-out");
    }
    expect(revoked.body.data.localWorkPreserved).toBe(true);
    expect(await store.get(sessionId, NOW)).toBeNull();
  });

  test("Next session route does not embed privileged secrets", () => {
    const source = readFileSync(
      new URL("../../../apps/pos-web/src/app/api/pos/v1/session/route.ts", import.meta.url),
      "utf8",
    );
    expect(source).toMatch(/composeStaffSessionStore/);
    expect(source).not.toMatch(/NEXT_PUBLIC_BRIDGE_/);
    expect(source).not.toMatch(/BRIDGE_APPLICATION_PASSWORD/);
    expect(source).not.toMatch(/SERVICE_ROLE_KEY\s*=/);
    expect(source).not.toMatch(/eyJ/);
  });
});
