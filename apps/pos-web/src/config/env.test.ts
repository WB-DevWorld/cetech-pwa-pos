import { describe, expect, it } from "vitest";

import { readServerEnv, staffAllowedOrigins } from "./env";

describe("preview origin resolution", () => {
  it("prefers APP_ORIGIN over platform metadata", () => {
    const env = {
      APP_ORIGIN: "https://pos-staging.example.com",
      VERCEL_URL: "generated-preview.vercel.app",
    };

    expect(readServerEnv(env).appOrigin).toBe("https://pos-staging.example.com");
    expect(staffAllowedOrigins(env)).toEqual(["https://pos-staging.example.com"]);
  });

  it("uses NEXT_PUBLIC_APP_ORIGIN before VERCEL_URL for compatibility", () => {
    const env = {
      NEXT_PUBLIC_APP_ORIGIN: "https://configured-preview.example.com",
      VERCEL_URL: "generated-preview.vercel.app",
    };

    expect(readServerEnv(env).appOrigin).toBe("https://configured-preview.example.com");
  });

  it("uses the exact HTTPS Vercel deployment origin when no explicit origin exists", () => {
    const env = {
      VERCEL_URL: "cetech-pos-staging-abc123.vercel.app",
    };

    expect(readServerEnv(env).appOrigin).toBe("https://cetech-pos-staging-abc123.vercel.app");
    expect(staffAllowedOrigins(env)).toEqual(["https://cetech-pos-staging-abc123.vercel.app"]);
  });

  it("normalizes an HTTPS VERCEL_URL and preserves explicit extra origins", () => {
    const env = {
      VERCEL_URL: "https://cetech-pos-staging-abc123.vercel.app/some-path",
      ALLOWED_ORIGINS: "https://device-lab.example.com,https://cetech-pos-staging-abc123.vercel.app",
    };

    expect(readServerEnv(env).appOrigin).toBe("https://cetech-pos-staging-abc123.vercel.app");
    expect(staffAllowedOrigins(env)).toEqual([
      "https://cetech-pos-staging-abc123.vercel.app",
      "https://device-lab.example.com",
    ]);
  });

  it("does not trust non-HTTPS Vercel metadata and falls back to local development", () => {
    const env = {
      VERCEL_URL: "http://unsafe-preview.example.com",
    };

    expect(readServerEnv(env).appOrigin).toBe("http://localhost:3000");
    expect(staffAllowedOrigins(env)).toEqual(["http://localhost:3000"]);
  });
});
