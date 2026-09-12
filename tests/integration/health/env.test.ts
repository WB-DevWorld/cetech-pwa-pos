import { describe, expect, test } from "vitest";
import { readServerEnv } from "../../../apps/pos-web/src/config/env";

describe("CORE-03 server env boundary", () => {
  test("public service-role aliases are rejected", () => {
    expect(() =>
      readServerEnv({
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "placeholder-not-a-real-secret",
      }),
    ).toThrow(/must not be exposed/);
  });

  test("server-only names stay readable without becoming public env", () => {
    const env = readServerEnv({
      APP_ORIGIN: "https://pos.example.test",
      SUPABASE_URL: "https://example.supabase.co",
      BRIDGE_BASE_URL: "https://staging-shop.example.invalid/wp-json/cetech-pos/v1",
      BUILD_ID: "build-fixture",
      SUPABASE_SERVICE_ROLE_KEY: "server-only",
    });
    expect(env.appOrigin).toBe("https://pos.example.test");
    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.bridgeBaseUrl).toContain("cetech-pos");
    expect(env.buildId).toBe("build-fixture");
    expect(JSON.stringify(env)).not.toMatch(/SERVICE_ROLE/i);
    expect(JSON.stringify(env)).not.toMatch(/server-only/);
  });
});
