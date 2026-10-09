import { describe, expect, test } from "vitest";
import { createEphemeralInMemoryStaffSessionStore } from "./session-store";
import { createMemoryStaffAccessControl, type StaffAccessControl } from "./staff-access-control";
import { establishStaffSession } from "./staff-session";
import type { StaffIdentityVerifier } from "./identity-verifier";

const NOW = new Date("2026-09-22T16:30:00.000Z");
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function verifier(actorId = "cashier_a"): StaffIdentityVerifier {
  return {
    async verify() {
      return {
        ok: true,
        identity: {
          actorId,
          displayName: actorId,
          organizationId: "org_a",
          locationIds: ["loc_a1"],
          registerId: "reg_a",
          capabilities: [],
          expiresAt: "2026-09-22T17:30:00.000Z",
        },
      };
    },
  };
}

describe("ADMIN-105 staff access gate", () => {
  test("missing access-control row remains active for compatibility", async () => {
    const result = await establishStaffSession({
      accessToken: "token",
      now: NOW,
      verifier: verifier(),
      accessControl: createMemoryStaffAccessControl(),
      store: createEphemeralInMemoryStaffSessionStore(),
      correlationId: CORRELATION,
      secureCookies: true,
    });
    expect(result.ok).toBe(true);
  });

  test("disabled staff cannot establish a POS BFF session", async () => {
    const store = createEphemeralInMemoryStaffSessionStore();
    const result = await establishStaffSession({
      accessToken: "token",
      now: NOW,
      verifier: verifier(),
      accessControl: createMemoryStaffAccessControl({
        "org_a:cashier_a": "disabled",
      }),
      store,
      correlationId: CORRELATION,
      secureCookies: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden");
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("disabled");
  });

  test("access-control outage fails closed", async () => {
    const unavailable: StaffAccessControl = {
      async status() {
        return "unavailable";
      },
    };
    const result = await establishStaffSession({
      accessToken: "token",
      now: NOW,
      verifier: verifier(),
      accessControl: unavailable,
      store: createEphemeralInMemoryStaffSessionStore(),
      correlationId: CORRELATION,
      secureCookies: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected unavailable");
    expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
  });

  test("post-insert disablement recheck revokes the just-created session", async () => {
    let calls = 0;
    let revoked = 0;
    const flipping: StaffAccessControl = {
      async status() {
        calls += 1;
        return calls === 1 ? "active" : "disabled";
      },
    };
    const inner = createEphemeralInMemoryStaffSessionStore();
    const store = {
      create: inner.create.bind(inner),
      get: inner.get.bind(inner),
      async revoke(sessionId: string) {
        revoked += 1;
        await inner.revoke(sessionId);
      },
      revokeActorSessions: inner.revokeActorSessions.bind(inner),
    };
    const result = await establishStaffSession({
      accessToken: "token",
      now: NOW,
      verifier: verifier(),
      accessControl: flipping,
      store,
      correlationId: CORRELATION,
      secureCookies: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected forbidden after post-insert recheck");
    expect(result.error.code).toBe("FORBIDDEN");
    expect(calls).toBe(2);
    expect(revoked).toBe(1);
  });
});
