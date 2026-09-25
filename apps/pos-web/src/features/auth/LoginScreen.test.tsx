import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { LoginScreen } from "./LoginScreen";

describe("LoginScreen", () => {
  test("renders signed-out production sign-in without fictional staff accounts", () => {
    const html = renderToStaticMarkup(
      createElement(LoginScreen, { onSignIn: () => undefined }),
    );
    expect(html).toContain("CETECH POS");
    expect(html).toContain("Scan → Sell → Pay → Print");
    expect(html).toContain("Sign in");
    expect(html).not.toContain("Ama Mensah");
    expect(html).not.toContain("Kofi Asare");
    expect(html).not.toContain("Demo staff");
    expect(html).not.toContain("demo-users");
  });

  test("renders expired, unauthorized, and locked notices", () => {
    const expired = renderToStaticMarkup(
      createElement(LoginScreen, { noticeState: "expired", onSignIn: () => undefined }),
    );
    expect(expired).toContain("Session ended.");
    expect(expired).toContain("Your session ended. Sign in again.");
    expect(expired).toContain("Your local cart has been kept.");

    const unauthorized = renderToStaticMarkup(
      createElement(LoginScreen, { noticeState: "unauthorized", onSignIn: () => undefined }),
    );
    expect(unauthorized).toContain("Access denied.");

    const locked = renderToStaticMarkup(
      createElement(LoginScreen, { noticeState: "locked", onSignIn: () => undefined }),
    );
    expect(locked).toContain("Register locked.");

    const offlineExpired = renderToStaticMarkup(
      createElement(LoginScreen, { noticeState: "offline_expired", onSignIn: () => undefined }),
    );
    expect(offlineExpired).toContain("Offline access expired.");

    const remoteUnconfirmed = renderToStaticMarkup(
      createElement(LoginScreen, { noticeState: "remote_sign_out_unconfirmed", onSignIn: () => undefined }),
    );
    expect(remoteUnconfirmed).toContain("Signed out on this device.");
    expect(remoteUnconfirmed).toContain("Remote sign-out could not be confirmed.");
    expect(offlineExpired).toContain("Your saved cart and transaction checks stay on this device.");
    expect(offlineExpired).not.toContain("Signed in and verified");
  });

  test("renders an adapter-supplied error without inventing staff identity", () => {
    const html = renderToStaticMarkup(
      createElement(LoginScreen, {
        errorMessage: "Sign-in is temporarily unavailable.",
        onSignIn: () => undefined,
      }),
    );
    expect(html).toContain("Sign-in is temporarily unavailable.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Ama Mensah");
  });

  test("renders classified sign-in notices without provider language", () => {
    const cases = [
      ["invalid_credentials", "Incorrect email or password."],
      ["access_disabled", "Your POS access is disabled. Contact a manager."],
      ["assignments_unavailable", "Register assignments couldn't be checked. Try again."],
      ["provider_unavailable", "Sign-in is temporarily unavailable. Try again."],
      ["offline_sign_in", "Internet connection required to sign in."],
    ] as const;
    for (const [noticeState, copy] of cases) {
      const html = renderToStaticMarkup(
        createElement(LoginScreen, { noticeState, onSignIn: () => undefined }),
      );
      expect(html.includes(copy) || html.includes(copy.replaceAll("'", "&#x27;"))).toBe(true);
      expect(html).not.toContain("invalid_credentials");
      expect(html).not.toContain("INTEGRATION_UNAVAILABLE");
      expect(html).not.toContain("Supabase");
      expect(html).not.toContain("PostgREST");
    }
  });

  test("disables the control while loading", () => {
    const html = renderToStaticMarkup(
      createElement(LoginScreen, { noticeState: "loading", onSignIn: () => undefined }),
    );
    expect(html).toContain("Signing in…");
    expect(html).toContain("disabled");
  });
});
