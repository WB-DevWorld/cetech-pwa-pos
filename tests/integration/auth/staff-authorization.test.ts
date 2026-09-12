import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { authorizeStaffAction } from "../../../apps/pos-web/src/server/auth/authorize";
import { parseStaffIdentityClaims } from "../../../apps/pos-web/src/server/auth/claims";
import { csrfSetCookie, sessionSetCookie } from "../../../apps/pos-web/src/server/auth/cookies";
import { createStaffIdentityVerifier } from "../../../apps/pos-web/src/server/auth/identity-verifier";
import { createMemoryStaffSessionStore } from "../../../apps/pos-web/src/server/auth/session-store";
import {
  cashierClaims,
  CORRELATION,
  directory,
  mutation,
  verified,
} from "./helpers";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("CORE-02 staff authorization", () => {
  test("verified staff with assignment and CSRF is authorized", async () => {
    const verifier = createStaffIdentityVerifier({
      async introspect() {
        return {
          status: "active",
          payload: {
            email: "cashier.a@example.test",
            exp: Math.floor(Date.now() / 1000) + 3600,
            app_metadata: {
              actor_id: "cashier_a",
              organization_id: "org_a",
              location_ids: ["loc_a1"],
              register_id: "reg_a",
            },
          },
        };
      },
    });
    const verifyResult = await verifier.verify({ accessToken: "opaque-token", now: new Date() });
    const result = await authorizeStaffAction({
      verifyResult,
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_a1", registerId: "reg_a" },
      mutation: mutation(),
    });
    expect(result.ok).toBe(true);
  });

  test("anonymous denied", async () => {
    const result = await authorizeStaffAction({
      verifyResult: { ok: false, reason: "anonymous" },
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_REQUIRED");
      expect(result.error.nextAction).toBe("reauthenticate");
    }
  });

  test("expired session denied", async () => {
    const result = await authorizeStaffAction({
      verifyResult: { ok: false, reason: "expired" },
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_REQUIRED");
    }
  });

  test("revoked identity verification denied", async () => {
    const result = await authorizeStaffAction({
      verifyResult: { ok: false, reason: "revoked" },
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_REQUIRED");
    }
  });

  test("malformed claims denied", async () => {
    expect(parseStaffIdentityClaims({ app_metadata: { actor_id: "" } })).toBeNull();
    const result = await authorizeStaffAction({
      verifyResult: { ok: false, reason: "malformed" },
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("AUTH_REQUIRED");
    }
  });

  test("provider timeout does not become trusted access", async () => {
    const verifier = createStaffIdentityVerifier({
      async introspect() {
        return { status: "timeout" };
      },
    });
    const verifyResult = await verifier.verify({ accessToken: "opaque-token", now: new Date() });
    const result = await authorizeStaffAction({
      verifyResult,
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_a1" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
    }
  });

  test("provider unavailable does not become trusted access", async () => {
    const result = await authorizeStaffAction({
      verifyResult: { ok: false, reason: "unavailable" },
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
    }
  });

  test("wrong organization denied", async () => {
    const result = await authorizeStaffAction({
      verifyResult: verified(),
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_b", locationId: "loc_a1" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  test("wrong location denied", async () => {
    const result = await authorizeStaffAction({
      verifyResult: verified(),
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_b1" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  test("unassigned register denied", async () => {
    const result = await authorizeStaffAction({
      verifyResult: verified(),
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_a1", registerId: "reg_a2" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  test("spoofed client actor denied", async () => {
    const result = await authorizeStaffAction({
      verifyResult: verified(),
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_a1", registerId: "reg_a" },
      client: { actorId: "manager_a" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  test("client capabilities never grant authority", async () => {
    const result = await authorizeStaffAction({
      verifyResult: verified(cashierClaims({ capabilities: [] })),
      assignments: directory(),
      correlationId: CORRELATION,
      required: {
        organizationId: "org_a",
        locationId: "loc_a1",
        registerId: "reg_a",
        permission: "shift.close",
        permittedServerCapabilities: [],
      },
      client: { capabilities: ["shift.close", "*"] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  test("buyer customer context never becomes staff identity", async () => {
    expect(
      parseStaffIdentityClaims({
        app_metadata: {
          customer_id: "cust_a",
          organization_id: "org_a",
          location_ids: ["loc_a1"],
        },
        display_name: "Buyer",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toBeNull();
    const result = await authorizeStaffAction({
      verifyResult: verified(),
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_a1" },
      client: { customerId: "cust_a" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  test("mutation without CSRF/origin is denied; matching CSRF/origin is allowed", async () => {
    const missing = await authorizeStaffAction({
      verifyResult: verified(),
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_a1", registerId: "reg_a" },
      mutation: mutation({ csrfHeader: null }),
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("FORBIDDEN");
    }

    const badOrigin = await authorizeStaffAction({
      verifyResult: verified(),
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_a1", registerId: "reg_a" },
      mutation: mutation({ origin: "https://evil.example" }),
    });
    expect(badOrigin.ok).toBe(false);

    const allowed = await authorizeStaffAction({
      verifyResult: verified(),
      assignments: directory(),
      correlationId: CORRELATION,
      required: { organizationId: "org_a", locationId: "loc_a1", registerId: "reg_a" },
      mutation: mutation(),
    });
    expect(allowed.ok).toBe(true);
    if (allowed.ok) {
      expect(allowed.data.session.actorId).toBe("cashier_a");
      expect(allowed.data.registerId).toBe("reg_a");
    }
  });

  test("session cookie is HttpOnly and Secure; CSRF cookie is not HttpOnly", () => {
    const expires = new Date("2026-09-13T00:00:00Z");
    const session = sessionSetCookie("sid-1", expires, true);
    expect(session).toContain("HttpOnly");
    expect(session).toContain("Secure");
    expect(session).toContain("SameSite=Lax");
    const csrf = csrfSetCookie("csrf-1", expires, true);
    expect(csrf).toContain("Secure");
    expect(csrf).not.toContain("HttpOnly");
  });

  test("expired stored session is not returned as trusted access", async () => {
    const store = createMemoryStaffSessionStore();
    const session = {
      actorId: "cashier_a",
      displayName: "Cashier A",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
      capabilities: [],
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const id = await store.create(session, "csrf", new Date(Date.now() - 1000));
    expect(await store.get(id, new Date())).toBeNull();
  });

  test("core identity modules do not contain service-role credentials", () => {
    const coreDir = path.join(REPO_ROOT, "apps/pos-web/src/core");
    const configDir = path.join(REPO_ROOT, "apps/pos-web/src/config");
    const files = [
      path.join(coreDir, "identity/staff-identity-port.ts"),
      path.join(coreDir, "identity/local-work.ts"),
      path.join(configDir, "secrets.ts"),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
      expect(source).not.toContain("service_role");
    }
  });
});
