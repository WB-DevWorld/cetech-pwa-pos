import { afterEach, describe, expect, it } from "vitest";
import type { PosRestFetch } from "../http/server-fetch";
import { composeBridgeSalesPort } from "./bridge-sales-port";
import { composeCheckoutRuntime, resetCheckoutRuntimeForTests } from "./compose-checkout-runtime";

const prepared = {
  transactionId: "11111111-1111-4111-8111-111111111111",
  saleId: "sale-1",
  orderReference: "1001",
  quoteFingerprint: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  total: { minor: 1500, currency: "GHS" },
  status: "prepared" as const,
  stockCommitment: "reserved" as const,
  preparedAt: "2026-09-15T00:00:00Z",
  expiresAt: "2026-09-15T00:15:00Z",
};

afterEach(() => {
  resetCheckoutRuntimeForTests();
});

describe("durable checkout runtime composition", () => {
  it("refuses staging without durable Supabase and bridge configuration", () => {
    expect(() => composeCheckoutRuntime({ APP_ENV: "staging" }, unreachableFetch())).toThrow(
      /durable checkout runtime requires Supabase infrastructure and Woo bridge service configuration/,
    );
  });

  it("composes durable staging runtime only when both infrastructures are configured", () => {
    const runtime = composeCheckoutRuntime(
      {
        APP_ENV: "staging",
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "server-secret-value",
        BRIDGE_BASE_URL: "https://training.example.test",
        BRIDGE_USERNAME: "pos-service",
        BRIDGE_APPLICATION_PASSWORD: "app-password-value",
      },
      unreachableFetch(),
    );
    expect(runtime.durable).toBe(true);
    expect(runtime.store).toBeDefined();
    expect(runtime.salesPort).toBeDefined();
    expect(runtime.quoteSnapshots).toBeDefined();
    expect(runtime.prepareIntents).toBeDefined();
  });

  it("never falls back to ephemeral runtime in production", () => {
    expect(() => composeCheckoutRuntime({ APP_ENV: "production" }, unreachableFetch())).toThrow();
  });
});

describe("Woo bridge SalesPort", () => {
  it("sends prepare with service auth, correlation and idempotency and validates response", async () => {
    const calls: Array<{ url: string; init: Parameters<PosRestFetch>[1] }> = [];
    const fetchImpl: PosRestFetch = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, data: prepared, correlationId: "22222222-2222-4222-8222-222222222222" }),
      };
    };
    const port = composeBridgeSalesPort(
      {
        BRIDGE_BASE_URL: "https://training.example.test/",
        BRIDGE_USERNAME: "pos-service",
        BRIDGE_APPLICATION_PASSWORD: "app-password-value",
      },
      fetchImpl,
    );
    expect(port).toBeDefined();
    const result = await port!.prepare(
      {
        transactionId: prepared.transactionId,
        registerId: "reg-a",
        shiftId: "33333333-3333-4333-8333-333333333333",
        deviceId: "44444444-4444-4444-8444-444444444444",
        quoteId: "quote-1",
        quoteFingerprint: prepared.quoteFingerprint,
      },
      {
        idempotencyKey: "55555555-5555-4555-8555-555555555555",
        correlationId: "22222222-2222-4222-8222-222222222222",
      },
    );
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://training.example.test/wp-json/cetech-pos/v1/sales/prepare");
    expect(calls[0]?.init.headers["idempotency-key"]).toBe("55555555-5555-4555-8555-555555555555");
    expect(calls[0]?.init.headers["x-correlation-id"]).toBe("22222222-2222-4222-8222-222222222222");
    expect(calls[0]?.init.headers.authorization).toMatch(/^Basic /);
  });

  it("uses observational GET for resolve", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    const fetchImpl: PosRestFetch = async (url, init) => {
      calls.push({ url, method: init.method });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          data: {
            transactionId: prepared.transactionId,
            status: "prepared",
            saleId: prepared.saleId,
            orderReference: prepared.orderReference,
          },
          correlationId: "66666666-6666-4666-8666-666666666666",
        }),
      };
    };
    const port = composeBridgeSalesPort(
      {
        BRIDGE_BASE_URL: "https://training.example.test",
        BRIDGE_USERNAME: "pos-service",
        BRIDGE_APPLICATION_PASSWORD: "app-password-value",
      },
      fetchImpl,
    );
    const result = await port!.resolve(prepared.transactionId);
    expect(result.ok).toBe(true);
    expect(calls[0]?.method).toBe("GET");
    expect(calls[0]?.url).toContain(`/sales/${prepared.transactionId}`);
  });
});

function unreachableFetch(): PosRestFetch {
  return async () => {
    throw new Error("network should not be called during composition");
  };
}
