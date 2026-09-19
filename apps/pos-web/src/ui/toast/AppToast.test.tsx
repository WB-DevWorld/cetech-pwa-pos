import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppToast } from "./AppToast";

describe("AppToast", () => {
  test("exposes a polite live region for success copy", () => {
    const html = renderToStaticMarkup(
      <AppToast title="Register opened." detail="Durable cart was preserved." />,
    );
    expect(html).toContain("Register opened.");
    expect(html).toContain("Durable cart was preserved.");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("app-toast");
  });
});
