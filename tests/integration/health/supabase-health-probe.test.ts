import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import {
  composeSupabaseHealthProbe,
  createSupabaseHealthProbe,
} from "../../../apps/pos-web/src/server/health/supabase-health-probe";
import type { PosRestFetch } from "../../../apps/pos-web/src/server/http/server-fetch";

const NOW = new Date("2026-09-13T13:30:00.000Z");

function restFrom(status: number, body: unknown = []): PosRestFetch {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe("CORE-03 real Supabase health probe", () => {
  test("environment presence without a probe is not healthy", () => {
    expect(
      composeSupabaseHealthProbe(
        {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: "REPLACE_WITH_SERVER_ONLY_KEY",
        },
        restFrom(200),
      ),
    ).toBeUndefined();
    expect(composeSupabaseHealthProbe({ SUPABASE_URL: "https://example.supabase.co" }, restFrom(200))).toBeUndefined();
  });

  test("2xx against POS organizations is connectivity only", async () => {
    const probe = createSupabaseHealthProbe({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: async (input) => {
        expect(input).toMatch(/pos_organizations\?select=id&limit=1$/);
        expect(input).not.toMatch(/customers|orders|payments/i);
        return { ok: true, status: 200, json: async () => [] };
      },
    });
    const check = await probe.check(NOW);
    expect(check.id).toBe("supabase");
    expect(check.status).toBe("healthy");
    expect(check.message).toMatch(/connectivity only/);
    expect(check.message).toMatch(/not checkout or pricing/);
    expect(check.message).not.toMatch(/pricingParityVerified=true/);
  });

  test("401/403 is degraded; timeout is unavailable; neither is trusted healthy from env", async () => {
    const denied = createSupabaseHealthProbe({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: restFrom(403),
    });
    expect((await denied.check(NOW)).status).toBe("degraded");

    const timeout = createSupabaseHealthProbe({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: async () => {
        const error = new Error("aborted");
        error.name = "TimeoutError";
        throw error;
      },
    });
    const timed = await timeout.check(NOW);
    expect(timed.status).toBe("unavailable");
    expect(timed.message).toMatch(/timed out/);
  });

  test("probe module is isolated from handle-store-health fetch ban", () => {
    const probe = readFileSync(
      new URL("../../../apps/pos-web/src/server/health/supabase-health-probe.ts", import.meta.url),
      "utf8",
    );
    expect(probe).toMatch(/fetchImpl/);
    const handler = readFileSync(
      new URL("../../../apps/pos-web/src/server/health/handle-store-health.ts", import.meta.url),
      "utf8",
    );
    expect(handler).not.toMatch(/\bfetch\s*\(/);
  });
});
