import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { AppShell } from "./AppShell";
import { PRIMARY_NAV_ITEMS, POS_ROUTE_HREFS } from "./routes";

function renderShell(activeRoute: "sell" | "settings" = "sell") {
  return renderToStaticMarkup(
    <AppShell
      activeRoute={activeRoute}
      registerName="Front Counter 1"
      cashierDisplayName="Staff member"
      shiftOpen
      online
      attentionCount={2}
      liveMessage="Ready"
    >
      <p>Workspace</p>
    </AppShell>,
  );
}

describe("AppShell", () => {
  test("renders skip link, landmarks, primary destinations, and settings", () => {
    const html = renderShell();
    expect(html).toContain("Skip to main content");
    expect(html).toContain('href="#main-content"');
    expect(html).toContain('aria-label="App sidebar"');
    expect(html).toContain('aria-label="Primary navigation"');
    expect(html).toContain("<header");
    expect(html).toContain("<main");
    expect(html).toContain("<nav");
    expect(html).toContain("<aside");
    expect(html).toContain('type="button"');
    expect(html).toContain('id="main-content"');
    expect(html).toContain("CETECH POS");
    expect(html).toContain("Front Counter 1");
    expect(html).toContain("Shift open");
    expect(html).toContain("Online");
    expect(html).toContain('data-online="true"');
    expect(html).toContain('aria-label="Online"');
    expect(html).toContain('aria-label="Lock register"');
    for (const item of PRIMARY_NAV_ITEMS) {
      expect(html).toContain(`data-route="${item.route}"`);
      expect(html).toContain(`data-href="${POS_ROUTE_HREFS[item.route]}"`);
      expect(html).toContain(item.label);
    }
    expect(html).toContain('data-route="settings"');
    expect(html).toContain("sidebar-bottom");
    expect(html).toContain("Attention");
    expect(html).toContain("2");
    expect(html).not.toContain("Demo controls");
    expect(html).not.toContain("demo-fab");
    expect(html).not.toContain("Ama Mensah");
    expect(html).not.toContain("Kofi Asare");
  });

  test("marks the active route for assistive technology", () => {
    const html = renderShell("settings");
    expect(html).toContain('data-route="settings"');
    expect(html).toContain('aria-current="page"');
  });

  test("exposes a polite live region", () => {
    const html = renderShell();
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Ready");
  });
});
