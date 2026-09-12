import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { STAFF_SESSION_COOKIE } from "../../../apps/pos-web/src/config/auth";
import { createEphemeralInMemoryStaffSessionStore } from "../../../apps/pos-web/src/server/auth/session-store";
import {
  createBridgeHealthClient,
  createBridgeServiceIdentity,
  mapBridgeHealth,
} from "../../../apps/pos-web/src/server/health/bridge-adapter";
import { handleStoreHealth } from "../../../apps/pos-web/src/server/health/handle-store-health";
import { withoutClaimedPricingParity } from "../../../apps/pos-web/src/server/health/probes";
import { CORRELATION, futureExpiry } from "../auth/helpers";

const NOW = new Date("2026-09-12T22:30:00.000Z");
const BRIDGE_BASE = "https://staging-shop.example.invalid/wp-json/cetech-pos/v1";

/** Envelope shape from BR-01 `tests/fixtures/commerce/bridge-health.success.example.json` at fbbf0ea7… */
const BR01_SUCCESS_ENVELOPE = {
  ok: true as const,
  data: {
    status: "healthy" as const,
    contractVersion: "1.0.0" as const,
    wooDetected: true,
    woodmartDetected: true,
    b2bkingDetected: true,
    pricingParityVerified: false,
  },
  correlationId: "550e8400-e29b-41d4-a716-446655440000",
};

async function staffCookie() {
  const store = createEphemeralInMemoryStaffSessionStore();
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

function clientWith(
  fetchImpl: Parameters<typeof createBridgeHealthClient>[0]["fetchImpl"],
) {
  return createBridgeHealthClient({
    baseUrl: BRIDGE_BASE,
    username: "bridge-service",
    applicationPassword: "app-pass-fixture",
    fetchImpl,
  });
}

describe("CORE-03 BFF bridge health/permission adapter", () => {
  test("maps the BR-01 success envelope and never sets pricing parity", () => {
    const health = mapBridgeHealth(BR01_SUCCESS_ENVELOPE);
    expect(health.status).toBe("healthy");
    expect(health.wooDetected).toBe(true);
    expect(health.woodmartDetected).toBe(true);
    expect(health.b2bkingDetected).toBe(true);
    expect(health.pricingParityVerified).toBe(false);
    expect(health.contractVersion).toBe("1.0.0");
  });

  test("forces pricingParityVerified false even when the body claims true", () => {
    const health = mapBridgeHealth({
      ok: true,
      data: { ...BR01_SUCCESS_ENVELOPE.data, pricingParityVerified: true },
    });
    expect(health.pricingParityVerified).toBe(false);
    expect(withoutClaimedPricingParity({ ...health, pricingParityVerified: true }).pricingParityVerified).toBe(
      false,
    );
  });

  test("unknown contract versions are unavailable and untrusted", () => {
    const health = mapBridgeHealth({
      ok: true,
      data: { ...BR01_SUCCESS_ENVELOPE.data, contractVersion: "9.9.9" },
    });
    expect(health.status).toBe("unavailable");
    expect(health.wooDetected).toBe(false);
    expect(health.pricingParityVerified).toBe(false);
  });

  test("ok:false envelopes are unavailable", () => {
    const health = mapBridgeHealth({
      ok: false,
      error: { code: "AUTH_REQUIRED" },
    });
    expect(health.status).toBe("unavailable");
    expect(health.pricingParityVerified).toBe(false);
  });

  test("service identity is Basic auth and refuses empty or service-role credentials", () => {
    const identity = createBridgeServiceIdentity({
      username: "bridge-service",
      applicationPassword: "app-pass-fixture",
    });
    expect(identity.authorizationHeader).toMatch(/^Basic /);
    expect(() => createBridgeServiceIdentity({ username: "", applicationPassword: "x" })).toThrow(
      /incomplete/,
    );
    expect(() =>
      createBridgeServiceIdentity({
        username: "bridge-service",
        applicationPassword: "SERVICE_ROLE_KEY",
      }),
    ).toThrow(/service-role/);
  });

  test("inspect sends Basic auth and correlation, never a staff cookie", async () => {
    const captured: { url?: string; headers?: Record<string, string> } = {};
    const client = clientWith(async (url, init) => {
      captured.url = url;
      captured.headers = init.headers;
      return { ok: true, status: 200, json: async () => BR01_SUCCESS_ENVELOPE };
    });
    const { check, health } = await client.inspect(CORRELATION, NOW);
    expect(captured.url).toBe(`${BRIDGE_BASE}/health`);
    expect(captured.headers?.Authorization).toMatch(/^Basic /);
    expect(captured.headers?.["X-Correlation-ID"]).toBe(CORRELATION);
    expect(captured.headers?.Cookie).toBeUndefined();
    expect(captured.headers?.cookie).toBeUndefined();
    expect(health.wooDetected).toBe(true);
    expect(health.pricingParityVerified).toBe(false);
    expect(check.status).toBe("unverified");
    expect(check.status).not.toBe("healthy");
    expect(check.message).toMatch(/wooDetected=true/);
    expect(check.message).toMatch(/pricingParityVerified=false/);
    expect(check.message).toMatch(/detection is not pricing parity/);
  });

  test("401/403 does not become trusted access", async () => {
    const client = clientWith(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ ok: false }),
    }));
    const { check, health } = await client.inspect(CORRELATION, NOW);
    expect(health.status).toBe("unavailable");
    expect(check.status).toBe("unavailable");
    expect(check.message).toMatch(/denied the BFF service identity/);
  });

  test("timeout does not become trusted access", async () => {
    const client = clientWith(async () => {
      const error = new Error("aborted");
      error.name = "TimeoutError";
      throw error;
    });
    const { check } = await client.inspect(CORRELATION, NOW);
    expect(check.status).toBe("unavailable");
    expect(check.message).toMatch(/timed out; not trusted access/);
  });

  test("5xx does not become trusted access", async () => {
    const client = clientWith(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    const { check } = await client.inspect(CORRELATION, NOW);
    expect(check.status).toBe("unavailable");
    expect(check.message).toMatch(/unavailable/);
  });

  test("authenticated store health with injected adapter surfaces detection without parity or live attach", async () => {
    const { store, cookieHeader } = await staffCookie();
    const client = clientWith(async () => ({
      ok: true,
      status: 200,
      json: async () => BR01_SUCCESS_ENVELOPE,
    }));
    const inspected = await client.inspect(CORRELATION, NOW);
    const result = await handleStoreHealth({
      correlationIdHeader: CORRELATION,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      supabaseConfigured: true,
      bridgeConfigured: true,
      buildId: "test-build",
      bridgeProbe: {
        async check() {
          return inspected.check;
        },
      },
      bridgeHealth: inspected.health,
    });
    expect(result.status).toBe(200);
    if (!result.body.ok) {
      throw new Error("expected success");
    }
    const byId = Object.fromEntries(result.body.data.checks.map((check) => [check.id, check]));
    expect(byId.bridge.status).toBe("unverified");
    expect(byId.bridge.message).toMatch(/wooDetected=true/);
    expect(byId["bridge-contract"].message).toMatch(/wooDetected=true/);
    expect(byId["bridge-contract"].message).toMatch(/pricingParityVerified=false/);
    expect(byId["bridge-contract"].message).toMatch(/detection is not pricing parity/);
    for (const check of result.body.data.checks) {
      expect(check.status).not.toBe("healthy");
    }
  });

  test("adapter and Next health route stay free of live default fetch and privileged secrets", () => {
    const adapter = readFileSync(
      new URL("../../../apps/pos-web/src/server/health/bridge-adapter.ts", import.meta.url),
      "utf8",
    );
    const route = readFileSync(
      new URL("../../../apps/pos-web/src/app/api/pos/v1/health/route.ts", import.meta.url),
      "utf8",
    );
    expect(adapter).not.toMatch(/\bfetch\s*\(/);
    expect(adapter).toMatch(/fetchImpl/);
    expect(adapter).not.toMatch(/SERVICE_ROLE_KEY\s*=/);
    expect(route).not.toMatch(/createBridgeHealthClient/);
    expect(route).not.toMatch(/BRIDGE_APPLICATION_PASSWORD/);
    expect(route).not.toMatch(/\bfetch\s*\(/);
  });
});
