import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => "/",
}));

import { PosSessionProvider } from "./pos-session-provider";

describe("R4 POS root page", () => {
  test("mounts the POS shell instead of the engineering scaffold copy", () => {
    const html = renderToStaticMarkup(createElement(PosSessionProvider, null, null));
    expect(html).toContain("CETECH POS");
    expect(html).toContain("Staff sign-in");
    expect(html).toContain('data-pos-runtime-owner="true"');
    expect(html).not.toContain("Staff member");
    expect(html).not.toContain("Shift open");
    expect(html).not.toContain("engineering scaffold");
  });
});
