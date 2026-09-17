import { describe, expect, test, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "fake-indexeddb/auto";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { PosRuntime } from "../../apps/pos-web/src/app/pos-app";
import { readFileSync } from "node:fs";

const layoutSource = readFileSync(new URL("../../apps/pos-web/src/app/layout.tsx", import.meta.url), "utf8");
const posAppSource = readFileSync(new URL("../../apps/pos-web/src/app/pos-app.tsx", import.meta.url), "utf8");

describe("R9-on-R8 primary POS routes", () => {
  test("root layout keeps R8 CSS, adds Health CSS, and mounts shared PWA lifecycle", () => {
    expect(layoutSource).toContain('import "@/features/sell/sell.css"');
    expect(layoutSource).toContain('import "@/features/returns/returns.css"');
    expect(layoutSource).toContain('import "@/features/register/register.css"');
    expect(layoutSource).toContain('import "@/features/health/health.css"');
    expect(layoutSource).toContain("<PwaLifecycleRuntime");
    expect(layoutSource).toContain("{children}");
  });

  test("/sell /returns /register /health mount their production runtimes", () => {
    const sell = renderToStaticMarkup(createElement(PosRuntime, { route: "sell", onNavigate: () => undefined }));
    const returns = renderToStaticMarkup(
      createElement(PosRuntime, { route: "returns", onNavigate: () => undefined }),
    );
    const register = renderToStaticMarkup(
      createElement(PosRuntime, { route: "register", onNavigate: () => undefined }),
    );
    const health = renderToStaticMarkup(
      createElement(PosRuntime, { route: "health", onNavigate: () => undefined }),
    );

    expect(sell).not.toContain("This workspace is not part of the active POS runtime.");
    expect(returns).toContain("Returns");
    expect(returns).not.toContain("This workspace is not part of the active POS runtime.");
    expect(register).toContain("Open register");
    expect(register).not.toContain("This workspace is not part of the active POS runtime.");
    expect(health).not.toContain("This workspace is not part of the active POS runtime.");
    expect(health).toMatch(/Store Health|Shared lifecycle runtime is unavailable/);
    expect(posAppSource).toContain("HealthRuntime");
    expect(posAppSource).toContain("ReturnsRuntimeScreen");
    expect(posAppSource).toContain("RegisterRuntimeScreen");
    expect(posAppSource).toContain("createTenderActivityPort");
    expect(posAppSource).toContain("fetchImpl");
  });
});
