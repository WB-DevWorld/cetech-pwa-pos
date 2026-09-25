import { describe, expect, test } from "vitest";
import { resolveInvitationRedirect } from "./invitation-redirect";

const STAGING = "https://pos-staging.example.com";

describe("invitation redirect", () => {
  test("uses the configured staging origin and not a deployment hash", () => {
    const redirect = resolveInvitationRedirect({
      APP_ENV: "staging",
      APP_ORIGIN: STAGING,
      VERCEL_URL: "cetech-pos-staging-c4cgnym0c-wbdevworlds-projects.vercel.app",
    });
    expect(redirect).toEqual({
      ok: true,
      origin: STAGING,
      redirectTo: `${STAGING}/auth/invite`,
    });
  });

  test("permits localhost in local development", () => {
    const redirect = resolveInvitationRedirect({
      APP_ENV: "local",
      APP_ORIGIN: "http://localhost:3000",
    });
    expect(redirect).toEqual({
      ok: true,
      origin: "http://localhost:3000",
      redirectTo: "http://localhost:3000/auth/invite",
    });
  });

  test("fails closed before a deployed invite when the origin is missing, malformed, or localhost", () => {
    expect(
      resolveInvitationRedirect({
        APP_ENV: "staging",
        VERCEL_URL: "cetech-pos-staging-abc123.vercel.app",
      }).ok,
    ).toBe(false);
    expect(resolveInvitationRedirect({ APP_ENV: "production", APP_ORIGIN: "not a url" })).toMatchObject({
      ok: false,
      reason: "malformed",
    });
    expect(resolveInvitationRedirect({ APP_ENV: "production", APP_ORIGIN: "http://localhost:3000" })).toMatchObject({
      ok: false,
      reason: "localhost_prohibited",
    });
    expect(resolveInvitationRedirect({ APP_ENV: "staging", APP_ORIGIN: "http://pos-staging.example.com" })).toMatchObject({
      ok: false,
      reason: "insecure",
    });
  });
});
