import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { STAFF_SESSION_COOKIE } from "../../../apps/pos-web/src/config/auth";
import { readBridgeServiceEnv } from "../../../apps/pos-web/src/config/env";
import { createEphemeralInMemoryStaffSessionStore } from "../../../apps/pos-web/src/server/auth/session-store";
import {
  createBridgeHealthClient,
  createBridgeServiceIdentity,
  mapBridgeHealth,
  bridgeHealthUrl,
} from "../../../apps/pos-web/src/server/health/bridge-adapter";
import { composeBridgeHealthInspect } from "../../../apps/pos-web/src/server/health/compose-bridge-health";
import { handleStoreHealth } from "../../../apps/pos-web/src/server/health/handle-store-health";
import { withoutClaimedPricingParity } from "../../../apps/pos-web/src/server/health/probes";
import { CORRELATION, futureExpiry } from "../auth/helpers";

const NOW = new Date("2026-09-12T22:30:00.000Z");
const BRIDGE_BASE = "https://staging-shop.example.invalid/wp-json/cetech-pos/v1";
const FIXTURE_CORRELATION = "550e8400-e29b-41d4-a716-446655440000";

/** Envelope shape from BR-01 `tests/fixtures/commerce/bridge-health.success.example.json`. */
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
  correlationId: FIXTURE_CORRELATION,
};

function successEnvelope(correlationId: string) {
  return { ...BR01_SUCCESS_ENVELOPE, correlationId };
}

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
      return { ok: true, status: 200, json: async () => successEnvelope(CORRELATION) };
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

  test("site-origin BRIDGE_BASE_URL still GETs /wp-json/cetech-pos/v1/health", async () => {
    expect(bridgeHealthUrl("https://training.example.invalid")).toBe(
      "https://training.example.invalid/wp-json/cetech-pos/v1/health",
    );
    expect(bridgeHealthUrl(`${BRIDGE_BASE}/`)).toBe(`${BRIDGE_BASE}/health`);
    const captured: { url?: string } = {};
    const client = createBridgeHealthClient({
      baseUrl: "https://training.example.invalid",
      username: "bridge-service",
      applicationPassword: "app-pass-fixture",
      fetchImpl: async (url) => {
        captured.url = url;
        return { ok: true, status: 200, json: async () => successEnvelope(CORRELATION) };
      },
    });
    await client.inspect(CORRELATION, NOW);
    expect(captured.url).toBe("https://training.example.invalid/wp-json/cetech-pos/v1/health");
  });

  test("site-origin BRIDGE_BASE_URL still GETs /wp-json/cetech-pos/v1/health", async () => {
    expect(bridgeHealthUrl("https://training.example.invalid")).toBe(
      "https://training.example.invalid/wp-json/cetech-pos/v1/health",
    );
    expect(bridgeHealthUrl(`${BRIDGE_BASE}/`)).toBe(`${BRIDGE_BASE}/health`);
    const captured: { url?: string } = {};
    const client = createBridgeHealthClient({
      baseUrl: "https://training.example.invalid",
      username: "bridge-service",
      applicationPassword: "app-pass-fixture",
      fetchImpl: async (url) => {
        captured.url = url;
        return { ok: true, status: 200, json: async () => successEnvelope(CORRELATION) };
      },
    });
    await client.inspect(CORRELATION, NOW);
    expect(captured.url).toBe("https://training.example.invalid/wp-json/cetech-pos/v1/health");
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
      json: async () => successEnvelope(CORRELATION),
    }));
    const result = await handleStoreHealth({
      correlationIdHeader: CORRELATION,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      supabaseConfigured: true,
      bridgeConfigured: true,
      buildId: "test-build",
      inspectBridge: (correlationId, now) => client.inspect(correlationId, now),
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

  test("matching response correlation is accepted; mismatch or malformed fails closed", async () => {
    const matching = clientWith(async () => ({
      ok: true,
      status: 200,
      json: async () => successEnvelope(CORRELATION),
      header: () => CORRELATION,
    }));
    const matched = await matching.inspect(CORRELATION, NOW);
    expect(matched.health.wooDetected).toBe(true);
    expect(matched.check.status).toBe("unverified");

    const mismatched = clientWith(async () => ({
      ok: true,
      status: 200,
      json: async () => BR01_SUCCESS_ENVELOPE,
    }));
    const mismatch = await mismatched.inspect(CORRELATION, NOW);
    expect(mismatch.health.status).toBe("unavailable");
    expect(mismatch.health.wooDetected).toBe(false);
    expect(mismatch.check.status).toBe("unavailable");
    expect(mismatch.check.message).toMatch(/correlation mismatch; not trusted access/);

    const missing = clientWith(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, data: BR01_SUCCESS_ENVELOPE.data }),
    }));
    const missingResult = await missing.inspect(CORRELATION, NOW);
    expect(missingResult.check.status).toBe("unavailable");
    expect(missingResult.health.wooDetected).toBe(false);

    const malformed = clientWith(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ...successEnvelope(CORRELATION), correlationId: "not-a-uuid" }),
    }));
    const malformedResult = await malformed.inspect(CORRELATION, NOW);
    expect(malformedResult.check.status).toBe("unavailable");
    expect(malformedResult.health.wooDetected).toBe(false);

    const headerMismatch = clientWith(async () => ({
      ok: true,
      status: 200,
      json: async () => successEnvelope(CORRELATION),
      header: () => FIXTURE_CORRELATION,
    }));
    const headerResult = await headerMismatch.inspect(CORRELATION, NOW);
    expect(headerResult.check.status).toBe("unavailable");
    expect(headerResult.health.wooDetected).toBe(false);
  });

  test("compose stays unattached without usable service identity and does not fetch", async () => {
    let fetched = false;
    const fetchImpl = async () => {
      fetched = true;
      return { ok: true, status: 200, json: async () => successEnvelope(CORRELATION) };
    };
    expect(composeBridgeHealthInspect({}, fetchImpl)).toBeUndefined();
    expect(
      composeBridgeHealthInspect(
        {
          BRIDGE_BASE_URL: BRIDGE_BASE,
          BRIDGE_USERNAME: "REPLACE_WITH_DEDICATED_SERVICE_USER",
          BRIDGE_APPLICATION_PASSWORD: "REPLACE_WITH_SERVER_ONLY_PASSWORD",
        },
        fetchImpl,
      ),
    ).toBeUndefined();
    expect(fetched).toBe(false);
    expect(readBridgeServiceEnv({ BRIDGE_BASE_URL: BRIDGE_BASE })).toBeNull();
  });

  test("composed inspect propagates request correlation into handleStoreHealth", async () => {
    const { store, cookieHeader } = await staffCookie();
    const inspectBridge = composeBridgeHealthInspect(
      {
        BRIDGE_BASE_URL: BRIDGE_BASE,
        BRIDGE_USERNAME: "bridge-service",
        BRIDGE_APPLICATION_PASSWORD: "app-pass-fixture",
      },
      async (_url, init) => {
        expect(init.headers["X-Correlation-ID"]).toBe(CORRELATION);
        return { ok: true, status: 200, json: async () => successEnvelope(CORRELATION) };
      },
    );
    expect(inspectBridge).toBeDefined();
    const result = await handleStoreHealth({
      correlationIdHeader: CORRELATION,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      supabaseConfigured: true,
      bridgeConfigured: true,
      buildId: "test-build",
      inspectBridge,
    });
    expect(result.status).toBe(200);
    expect(result.body.correlationId).toBe(CORRELATION);
    if (!result.body.ok) {
      throw new Error("expected success");
    }
    const byId = Object.fromEntries(result.body.data.checks.map((check) => [check.id, check]));
    expect(byId.bridge.message).toMatch(/wooDetected=true/);
    expect(byId.bridge.status).not.toBe("healthy");
  });

  test("adapter has no default live fetch; Next route does not embed privileged secrets", () => {
    const adapter = readFileSync(
      new URL("../../../apps/pos-web/src/server/health/bridge-adapter.ts", import.meta.url),
      "utf8",
    );
    const route = readFileSync(
      new URL("../../../apps/pos-web/src/app/api/pos/v1/health/route.ts", import.meta.url),
      "utf8",
    );
    const compose = readFileSync(
      new URL("../../../apps/pos-web/src/server/health/compose-bridge-health.ts", import.meta.url),
      "utf8",
    );
    expect(adapter).not.toMatch(/\bfetch\s*\(/);
    expect(adapter).toMatch(/fetchImpl/);
    expect(adapter).not.toMatch(/SERVICE_ROLE_KEY\s*=/);
    expect(route).toMatch(/composeBridgeHealthInspect/);
    expect(route).not.toMatch(/BRIDGE_APPLICATION_PASSWORD/);
    expect(route).not.toMatch(/NEXT_PUBLIC_BRIDGE_/);
    expect(compose).toMatch(/createServerBridgeFetch/);
    expect(compose).toMatch(/fetchImpl/);
  });
});
