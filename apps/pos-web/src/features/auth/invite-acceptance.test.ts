import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { STAFF_PRESENTATION_COPY } from "../../core/identity/staff-presentation-notice";
import { InviteAcceptanceView } from "./InviteAcceptance";
import {
  completeInvitedPassword,
  consumeInviteCallback,
  INVITE_INVALID_COPY,
  INVITE_PASSWORD_SAVED_COPY,
} from "./invite-acceptance";

const TOKEN = "synthetic-invite-token";

describe("invitation acceptance", () => {
  test("recognizes an invite callback and drops the token from the next location", () => {
    const ready = consumeInviteCallback(`#access_token=${TOKEN}&expires_in=3600&type=invite`, "");
    expect(ready.status).toBe("ready");
    expect(ready.nextLocation).toBe("/auth/invite");
    expect(ready.nextLocation).not.toContain(TOKEN);
    expect(ready.nextLocation).not.toContain("access_token");
  });

  test("invalid, expired, and missing callbacks grant no session material", () => {
    for (const input of [
      ["#error=access_denied&error_code=otp_expired&type=invite", ""],
      ["#access_token=&type=invite", ""],
      ["", ""],
      [`#access_token=${TOKEN}&type=recovery`, ""],
    ] as const) {
      const result = consumeInviteCallback(input[0], input[1]);
      expect(result).toEqual({ status: "invalid", nextLocation: "/auth/invite" });
      expect(JSON.stringify(result)).not.toContain(TOKEN);
    }
  });

  test("shows safe copy and a password step without the token", () => {
    const invalid = renderToStaticMarkup(createElement(InviteAcceptanceView, { phase: "invalid" }));
    expect(invalid).toContain(INVITE_INVALID_COPY);
    expect(invalid).toContain("CETECH POS");
    expect(invalid.toLowerCase()).not.toContain("supabase");
    expect(invalid).not.toContain(TOKEN);

    const ready = renderToStaticMarkup(createElement(InviteAcceptanceView, { phase: "ready" }));
    expect(ready).toContain("Save password");
    expect(ready).toContain("does not assign a register");
    expect(ready).not.toContain(TOKEN);

    const saved = renderToStaticMarkup(createElement(InviteAcceptanceView, { phase: "saved" }));
    expect(saved).toContain(INVITE_PASSWORD_SAVED_COPY);
    expect(saved).toContain('href="/"');
  });

  test("saves a password with the invite token and does not echo it", async () => {
    let authorization = "";
    let path = "";
    const saved = await completeInvitedPassword({
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-test-key",
      accessToken: TOKEN,
      password: "correct-password",
      fetchImpl: async (input, init) => {
        path = String(input);
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        return new Response("{}", { status: 200 });
      },
    });
    expect(saved).toBe("saved");
    expect(new URL(path).pathname).toBe("/auth/v1/user");
    expect(authorization).toBe(`Bearer ${TOKEN}`);

    const expired = await completeInvitedPassword({
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-test-key",
      accessToken: TOKEN,
      password: "correct-password",
      fetchImpl: async () => new Response(JSON.stringify({ error_code: "otp_expired", access_token: TOKEN }), { status: 401 }),
    });
    expect(expired).toBe("invalid");
    expect(String(expired)).not.toContain(TOKEN);

    const unavailable = await completeInvitedPassword({
      supabaseUrl: "https://project.supabase.co",
      publishableKey: "publishable-test-key",
      accessToken: TOKEN,
      password: "correct-password",
      fetchImpl: async () => new Response("upstream", { status: 503 }),
    });
    expect(unavailable).toBe("unavailable");
    expect(STAFF_PRESENTATION_COPY.provider_unavailable).not.toContain("supabase");
  });
});
