import { describe, expect, test } from "vitest";
import { assertNoPublicServiceRole, publicEnvLeaksServerSecret } from "../../../apps/pos-web/src/config/secrets";

describe("CORE-02 secret boundary", () => {
  test("NEXT_PUBLIC service-role values are rejected", () => {
    const leaks = publicEnvLeaksServerSecret({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-key",
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "placeholder-not-a-real-secret",
    });
    expect(leaks).toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
    expect(() =>
      assertNoPublicServiceRole({
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "placeholder-not-a-real-secret",
      }),
    ).toThrow(/must not be exposed/);
  });

  test("server-only service role env is not treated as a public leak", () => {
    expect(
      publicEnvLeaksServerSecret({
        SUPABASE_SERVICE_ROLE_KEY: "server-only",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-public-key",
      }),
    ).toEqual([]);
  });

  test("NEXT_PUBLIC bridge application-password values are rejected", () => {
    expect(
      publicEnvLeaksServerSecret({
        NEXT_PUBLIC_BRIDGE_APPLICATION_PASSWORD: "placeholder-not-a-real-secret",
      }),
    ).toContain("NEXT_PUBLIC_BRIDGE_APPLICATION_PASSWORD");
  });
});
