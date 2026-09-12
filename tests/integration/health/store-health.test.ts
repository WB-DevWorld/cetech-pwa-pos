import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { STAFF_SESSION_COOKIE } from "../../../apps/pos-web/src/config/auth";
import { createEphemeralInMemoryStaffSessionStore } from "../../../apps/pos-web/src/server/auth/session-store";
import { isUuid } from "../../../apps/pos-web/src/server/auth/ids";
import { handleStoreHealth } from "../../../apps/pos-web/src/server/health/handle-store-health";
import { mockBridgeHealth } from "../../../apps/pos-web/src/server/health/probes";
import { CORRELATION, futureExpiry } from "../auth/helpers";

const NOW = new Date("2026-09-12T21:30:00.000Z");

async function staffCookie(store = createEphemeralInMemoryStaffSessionStore()) {
  const sessionId = await store.create(
    {
      actorId: "cashier_a",
      displayName: "Cashier A",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
      capabilities: ["ui.hint.only"],
      expiresAt: futureExpiry(),
    },
    "csrf-not-required-for-get",
    new Date(NOW.getTime() + 3600_000),
  );
  return { store, cookieHeader: `${STAFF_SESSION_COOKIE}=${sessionId}` };
}

describe("CORE-03 PREP_ONLY store health", () => {
  test("anonymous request is AUTH_REQUIRED", async () => {
    const result = await handleStoreHealth({
      correlationIdHeader: CORRELATION,
      now: NOW,
      sessionStore: createEphemeralInMemoryStaffSessionStore(),
      supabaseConfigured: true,
      bridgeConfigured: true,
      buildId: "test-build",
    });
    expect(result.status).toBe(401);
    expect(result.headers["Cache-Control"]).toBe("no-store");
    expect(result.headers["X-Correlation-ID"]).toBe(CORRELATION);
    expect(result.body.ok).toBe(false);
    if (result.body.ok) {
      throw new Error("expected failure");
    }
    expect(result.body.error.code).toBe("AUTH_REQUIRED");
    expect(result.body.error.retryable).toBe(false);
    expect(result.body.error.nextAction).toBe("reauthenticate");
  });

  test("expired session is AUTH_REQUIRED", async () => {
    const store = createEphemeralInMemoryStaffSessionStore();
    const sessionId = await store.create(
      {
        actorId: "cashier_a",
        displayName: "Cashier A",
        organizationId: "org_a",
        locationIds: ["loc_a1"],
        capabilities: [],
        expiresAt: "2026-09-12T20:00:00.000Z",
      },
      "csrf",
      new Date("2026-09-12T20:00:00.000Z"),
    );
    const result = await handleStoreHealth({
      correlationIdHeader: CORRELATION,
      cookieHeader: `${STAFF_SESSION_COOKIE}=${sessionId}`,
      now: NOW,
      sessionStore: store,
      supabaseConfigured: false,
      bridgeConfigured: false,
      buildId: "test-build",
    });
    expect(result.status).toBe(401);
    expect(result.body.ok).toBe(false);
  });

  test("missing or malformed correlation is VALIDATION_ERROR with a generated UUID", async () => {
    const { store, cookieHeader } = await staffCookie();
    for (const header of [undefined, "", "not-a-uuid"]) {
      const result = await handleStoreHealth({
        correlationIdHeader: header,
        cookieHeader,
        now: NOW,
        sessionStore: store,
        supabaseConfigured: false,
        bridgeConfigured: false,
        buildId: "test-build",
      });
      expect(result.status).toBe(400);
      expect(result.body.ok).toBe(false);
      if (result.body.ok) {
        throw new Error("expected failure");
      }
      expect(result.body.error.code).toBe("VALIDATION_ERROR");
      expect(isUuid(result.body.correlationId)).toBe(true);
      expect(result.body.correlationId).not.toBe(header);
      expect(result.headers["X-Correlation-ID"]).toBe(result.body.correlationId);
    }
  });

  test("mixed-case UUID correlation is accepted as lowercase", async () => {
    const { store, cookieHeader } = await staffCookie();
    const result = await handleStoreHealth({
      correlationIdHeader: "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE",
      cookieHeader,
      now: NOW,
      sessionStore: store,
      supabaseConfigured: false,
      bridgeConfigured: false,
      buildId: "test-build",
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.correlationId).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });

  test("authenticated GET does not require CSRF and never claims live detection or parity", async () => {
    const { store, cookieHeader } = await staffCookie();
    const result = await handleStoreHealth({
      correlationIdHeader: CORRELATION,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      supabaseConfigured: true,
      bridgeConfigured: true,
      buildId: "test-build",
    });
    expect(result.status).toBe(200);
    expect(result.headers["Cache-Control"]).toBe("no-store");
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      throw new Error("expected success");
    }
    expect(result.body.correlationId).toBe(CORRELATION);
    expect(result.body.data.contractVersion).toBe("1.0.0");
    expect(result.body.data.buildId).toBe("test-build");
    expect(result.body.data.pendingOperationCount).toBe(0);
    expect(result.body.data.attentionCount).toBe(0);
    const byId = Object.fromEntries(result.body.data.checks.map((check) => [check.id, check]));
    expect(byId.supabase.status).toBe("unverified");
    expect(byId.supabase.message).toMatch(/PREP_ONLY/);
    expect(byId.bridge.status).toBe("unverified");
    expect(byId.bridge.message).toMatch(/detection is not pricing parity/);
    expect(byId["bridge-contract"].message).toMatch(/wooDetected=false/);
    expect(byId["bridge-contract"].message).toMatch(/pricingParityVerified=false/);
    expect(byId["bridge-contract"].message).toMatch(/detection is not pricing parity/);
    for (const check of result.body.data.checks) {
      expect(check.status).not.toBe("healthy");
    }
  });

  test("provider timeout or probe failure does not become trusted healthy access", async () => {
    const { store, cookieHeader } = await staffCookie();
    const result = await handleStoreHealth({
      correlationIdHeader: CORRELATION,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      supabaseConfigured: true,
      bridgeConfigured: true,
      buildId: "test-build",
      supabaseProbe: {
        async check() {
          throw new Error("timed out");
        },
      },
      bridgeProbe: {
        async check(now) {
          return {
            id: "bridge",
            status: "unavailable",
            message: "probe timed out; PREP_ONLY mock",
            checkedAt: now.toISOString(),
          };
        },
      },
    });
    expect(result.status).toBe(200);
    if (!result.body.ok) {
      throw new Error("BFF itself should answer");
    }
    const byId = Object.fromEntries(result.body.data.checks.map((check) => [check.id, check]));
    expect(byId.supabase.status).toBe("unavailable");
    expect(byId.supabase.message).toMatch(/not trusted access/);
    expect(byId.bridge.status).toBe("unavailable");
    expect(byId.bridge.status).not.toBe("healthy");
  });

  test("PREP_ONLY BridgeHealth never sets detection or pricing parity", () => {
    const health = mockBridgeHealth();
    expect(health.status).toBe("unavailable");
    expect(health.wooDetected).toBe(false);
    expect(health.woodmartDetected).toBe(false);
    expect(health.b2bkingDetected).toBe(false);
    expect(health.pricingParityVerified).toBe(false);
  });

  test("health and env modules do not fetch live services or embed service-role credentials", () => {
    const files = [
      "apps/pos-web/src/server/health/handle-store-health.ts",
      "apps/pos-web/src/server/health/probes.ts",
      "apps/pos-web/src/app/api/pos/v1/health/route.ts",
      "apps/pos-web/src/config/env.ts",
    ];
    for (const relative of files) {
      const source = readFileSync(new URL(`../../../${relative}`, import.meta.url), "utf8");
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/SERVICE_ROLE_KEY\s*=/);
      expect(source).not.toMatch(/\bwp-json\b/);
    }
  });
});
