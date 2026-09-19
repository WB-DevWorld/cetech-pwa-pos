import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(resolve(dir, "apps/pos-web/src/ui/tokens.css"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error(`Unable to locate repository root from ${process.cwd()}`);
}

const evidenceDir = resolve(findRepoRoot(), "tests/frontend/evidence");

function readEvidence(name: string): string {
  const path = resolve(evidenceDir, name);
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run pnpm --dir apps/pos-web test so the Vitest harness writes HTML evidence.`);
  }
  return readFileSync(path, "utf8");
}

async function capture(page: Page, htmlName: string, pngName: string, viewport: { width: number; height: number }) {
  const html = readEvidence(htmlName);
  await page.setViewportSize(viewport);
  await page.setContent(html, { waitUntil: "load" });
  await expect(page.getByText("Demo controls")).toHaveCount(0);
  await page.screenshot({ path: resolve(evidenceDir, pngName), fullPage: true });
}

test.describe("UX-04 current baseline (pre-implementation)", () => {
  test("settings desktop", async ({ page }) => {
    await capture(page, "ux-04-baseline-settings-1920.html", "ux-04-baseline-settings-1920.png", { width: 1920, height: 868 });
  });
  test("attention desktop", async ({ page }) => {
    await capture(page, "ux-04-baseline-attention-1920.html", "ux-04-baseline-attention-1920.png", { width: 1920, height: 868 });
  });
  test("health desktop", async ({ page }) => {
    await capture(page, "ux-04-baseline-health-1920.html", "ux-04-baseline-health-1920.png", { width: 1920, height: 1241 });
  });
  test("register desktop", async ({ page }) => {
    await capture(page, "ux-04-baseline-register-1920.html", "ux-04-baseline-register-1920.png", { width: 1920, height: 868 });
  });
  test("orders desktop", async ({ page }) => {
    await capture(page, "ux-04-baseline-orders-1920.html", "ux-04-baseline-orders-1920.png", { width: 1920, height: 868 });
  });
  test("customers desktop", async ({ page }) => {
    await capture(page, "ux-04-baseline-customers-1920.html", "ux-04-baseline-customers-1920.png", { width: 1920, height: 868 });
  });
  test("returns desktop", async ({ page }) => {
    await capture(page, "ux-04-baseline-returns-1920.html", "ux-04-baseline-returns-1920.png", { width: 1920, height: 868 });
  });
});
