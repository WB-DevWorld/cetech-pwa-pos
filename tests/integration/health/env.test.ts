import { describe, expect, test } from "vitest";
import { readBridgeServiceEnv, readServerEnv, readSupabaseAuthEnv, readSupabaseInfrastructureEnv } from "../../../apps/pos-web/src/config/env";

describe("CORE-03 server env boundary", () => {
  test("public service-role aliases are rejected", () => {
    expect(() =>
      readServerEnv({
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "placeholder-not-a-real-secret",
      }),
    ).toThrow(/must not be exposed/);
  });

  test("public bridge application-password aliases are rejected", () => {
    expect(() =>
      readServerEnv({
        NEXT_PUBLIC_BRIDGE_APPLICATION_PASSWORD: "placeholder-not-a-real-secret",
      }),
    ).toThrow(/must not be exposed/);
  });

  test("public bridge username aliases are rejected", () => {
    expect(() =>
      readServerEnv({
        NEXT_PUBLIC_BRIDGE_USERNAME: "bridge-service",
      }),
    ).toThrow(/must not be exposed/);
  });

  test("public bridge base-url aliases are rejected", () => {
    expect(() =>
      readServerEnv({
        NEXT_PUBLIC_BRIDGE_BASE_URL: "https://staging-shop.example.invalid/wp-json/cetech-pos/v1",
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
      BRIDGE_USERNAME: "bridge-service",
      BRIDGE_APPLICATION_PASSWORD: "app-pass-fixture",
    });
    expect(env.appOrigin).toBe("https://pos.example.test");
    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.bridgeBaseUrl).toContain("cetech-pos");
    expect(env.buildId).toBe("build-fixture");
    expect(JSON.stringify(env)).not.toMatch(/SERVICE_ROLE/i);
    expect(JSON.stringify(env)).not.toMatch(/server-only/);
    expect(JSON.stringify(env)).not.toMatch(/bridge-service/);
    expect(JSON.stringify(env)).not.toMatch(/app-pass-fixture/);
  });

  test("bridge service identity is server-only and ignores placeholders", () => {
    expect(
      readBridgeServiceEnv({
        BRIDGE_BASE_URL: "https://staging-shop.example.invalid/wp-json/cetech-pos/v1",
        BRIDGE_USERNAME: "REPLACE_WITH_DEDICATED_SERVICE_USER",
        BRIDGE_APPLICATION_PASSWORD: "REPLACE_WITH_SERVER_ONLY_PASSWORD",
      }),
    ).toBeNull();
    const identity = readBridgeServiceEnv({
      BRIDGE_BASE_URL: "https://staging-shop.example.invalid/wp-json/cetech-pos/v1",
      BRIDGE_USERNAME: "bridge-service",
      BRIDGE_APPLICATION_PASSWORD: "app-pass-fixture",
    });
    expect(identity?.username).toBe("bridge-service");
    expect(identity?.applicationPassword).toBe("app-pass-fixture");
  });

  test("supabase infrastructure env ignores placeholders and is not a health proof", () => {
    expect(
      readSupabaseInfrastructureEnv({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "REPLACE_WITH_SERVER_ONLY_KEY",
      }),
    ).toBeNull();
    const infra = readSupabaseInfrastructureEnv({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "server-only-infrastructure",
    });
    expect(infra?.url).toBe("https://example.supabase.co");
    expect(
      readSupabaseAuthEnv({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "REPLACE_WITH_LOCAL_OR_STAGING_PUBLISHABLE_KEY",
      }),
    ).toBeNull();
  });
});
