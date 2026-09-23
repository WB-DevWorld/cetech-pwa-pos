import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { createStaffIdentityVerifier } from "../../../apps/pos-web/src/server/auth/identity-verifier";
import { createEphemeralInMemoryStaffSessionStore } from "../../../apps/pos-web/src/server/auth/session-store";
import {
  handleEstablishStaffSession,
  handleReadStaffSession,
  handleRevokeStaffSession,
} from "../../../apps/pos-web/src/server/auth/handle-staff-session";
import { CORRELATION, ORIGIN, cashierClaims, directory } from "./helpers";

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
      assignments: directory(),
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
      assignments: directory(),
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
      assignments: directory(),
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
      assignments: directory(),
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

  test("GET recovers the staff session without CSRF and expired sessions fail closed", async () => {
    const store = createEphemeralInMemoryStaffSessionStore();
    const assignments = directory();
    const established = await handleEstablishStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      authorizationHeader: "Bearer synthetic-staff-access-token",
      now: NOW,
      verifier: verifierOk(),
      assignments: directory(),
      store,
      allowedOrigins: [ORIGIN],
      secureCookies: true,
    });
    expect(established.body.ok).toBe(true);
    const sessionCookie = established.cookies.find((cookie) => cookie.startsWith("cetech_pos_sid="));
    const sessionId = sessionCookie?.split(";")[0]?.split("=")[1] ?? "";

    const recovered = await handleReadStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: `cetech_pos_sid=${sessionId}`,
      now: NOW,
      store,
      assignments,
      allowedOrigins: [ORIGIN],
    });
    expect(recovered.status).toBe(200);
    expect(recovered.body.ok).toBe(true);
    if (!recovered.body.ok) {
      throw new Error("expected recovered session");
    }
    expect(recovered.body.data.session.displayName).toBe("Cashier A");
    expect(recovered.body.data.assignedRegisterIds).toEqual(["reg_a"]);
    expect(recovered.body.data.assignedLocationIds).toEqual(["loc_a1"]);

    const missing = await handleReadStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      now: NOW,
      store,
      assignments,
      allowedOrigins: [ORIGIN],
    });
    expect(missing.status).toBe(401);

    const expired = await handleReadStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: `cetech_pos_sid=${sessionId}`,
      now: new Date("2099-01-01T00:00:00.000Z"),
      store,
      assignments,
      allowedOrigins: [ORIGIN],
    });
    expect(expired.status).toBe(401);
  });

  test("GET refreshes session scope from current durable assignments", async () => {
    const store = createEphemeralInMemoryStaffSessionStore();
    const established = await handleEstablishStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      authorizationHeader: "Bearer synthetic-staff-access-token",
      now: NOW,
      verifier: verifierOk(),
      assignments: directory(),
      store,
      allowedOrigins: [ORIGIN],
      secureCookies: true,
    });
    expect(established.body.ok).toBe(true);
    const sessionCookie = established.cookies.find((cookie) => cookie.startsWith("cetech_pos_sid="));
    const sessionId = sessionCookie?.split(";")[0]?.split("=")[1] ?? "";

    const recovered = await handleReadStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: `cetech_pos_sid=${sessionId}`,
      now: NOW,
      store,
      assignments: {
        async lookup() {
          return {
            locationIds: ["loc_a1", "loc_a2"],
            registerIds: ["reg_a", "reg_b"],
            registerAssignments: [
              { registerId: "reg_a", locationId: "loc_a1" },
              { registerId: "reg_b", locationId: "loc_a2" },
            ],
            locationRoles: [
              { locationId: "loc_a1", role: "manager" as const },
              { locationId: "loc_a2", role: "manager" as const },
            ],
          };
        },
      },
      allowedOrigins: [ORIGIN],
    });

    expect(recovered.status).toBe(200);
    expect(recovered.body.ok).toBe(true);
    if (!recovered.body.ok) {
      throw new Error("expected recovered session");
    }
    expect(recovered.body.data.assignedLocationIds).toEqual(["loc_a1", "loc_a2"]);
    expect(recovered.body.data.assignedRegisterIds).toEqual(["reg_a", "reg_b"]);
  });

  test("GET exposes current durable register ids when the directory lacks optional mapping", async () => {
    const store = createEphemeralInMemoryStaffSessionStore();
    const established = await handleEstablishStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      authorizationHeader: "Bearer synthetic-staff-access-token",
      now: NOW,
      verifier: verifierOk(),
      assignments: directory(),
      store,
      allowedOrigins: [ORIGIN],
      secureCookies: true,
    });
    expect(established.body.ok).toBe(true);
    const sessionCookie = established.cookies.find((cookie) => cookie.startsWith("cetech_pos_sid="));
    const sessionId = sessionCookie?.split(";")[0]?.split("=")[1] ?? "";

    const recovered = await handleReadStaffSession({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: `cetech_pos_sid=${sessionId}`,
      now: NOW,
      store,
      assignments: {
        async lookup() {
          return {
            locationIds: ["loc_a1", "loc_a2"],
            registerIds: ["reg_a", "reg_b"],
            locationRoles: [
              { locationId: "loc_a1", role: "manager" as const },
              { locationId: "loc_a2", role: "manager" as const },
            ],
          };
        },
      },
      allowedOrigins: [ORIGIN],
    });

    expect(recovered.status).toBe(200);
    expect(recovered.body.ok).toBe(true);
    if (!recovered.body.ok) {
      throw new Error("expected recovered session");
    }
    expect(recovered.body.data.assignedLocationIds).toEqual(["loc_a1", "loc_a2"]);
    expect(recovered.body.data.assignedRegisterIds).toEqual(["reg_a", "reg_b"]);
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
