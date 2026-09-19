import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => "/health",
}));

import { PosSessionProvider } from "./pos-session-provider";

describe("STG-02 persistent POS session owner", () => {
  test("layout owner renders a single staff runtime for a mounted POS path", () => {
    const html = renderToStaticMarkup(createElement(PosSessionProvider, null, null));
    expect(html.match(/Staff sign-in/g)?.length).toBe(1);
    expect(html.match(/data-pos-runtime-owner="true"/g)?.length).toBe(1);
    expect(html).toContain("Signing in…");
  });
});
