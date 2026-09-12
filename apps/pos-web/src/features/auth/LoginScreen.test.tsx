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
    expect(expired).toContain("Session expired.");
    expect(expired).toContain("Your local cart has been kept.");

    const unauthorized = renderToStaticMarkup(
      createElement(LoginScreen, { noticeState: "unauthorized", onSignIn: () => undefined }),
    );
    expect(unauthorized).toContain("Access denied.");

    const locked = renderToStaticMarkup(
      createElement(LoginScreen, { noticeState: "locked", onSignIn: () => undefined }),
    );
    expect(locked).toContain("Register locked.");
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

  test("disables the control while loading", () => {
    const html = renderToStaticMarkup(
      createElement(LoginScreen, { noticeState: "loading", onSignIn: () => undefined }),
    );
    expect(html).toContain("Signing in…");
    expect(html).toContain("disabled");
  });
});
