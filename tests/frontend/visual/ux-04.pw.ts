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

test.describe("UX-04 operational workspaces (fixture harness)", () => {
  test("settings desktop", async ({ page }) => {
    await capture(page, "ux-04-settings.html", "ux-04-settings-1920.png", { width: 1920, height: 868 });
  });
  test("attention desktop", async ({ page }) => {
    await capture(page, "ux-04-attention.html", "ux-04-attention-1920.png", { width: 1920, height: 868 });
    await expect(page.getByText("Check / Recover")).toBeVisible();
    await expect(page.getByText("MEDIUM")).toBeVisible();
  });
  test("health desktop", async ({ page }) => {
    await capture(page, "ux-04-health.html", "ux-04-health-1920.png", { width: 1920, height: 1241 });
    await expect(page.getByRole("heading", { name: "Store Health" })).toBeVisible();
    await expect(page.getByText("Simulate update ready")).toHaveCount(0);
  });
  test("health catalog toast desktop", async ({ page }) => {
    await capture(page, "ux-04-health-toast.html", "ux-04-health-toast-1920.png", { width: 1920, height: 1241 });
    await expect(page.getByText("Rebuildable catalog projection refreshed.")).toBeVisible();
  });
  test("register desktop", async ({ page }) => {
    await capture(page, "ux-04-register.html", "ux-04-register-1920.png", { width: 1920, height: 868 });
    await expect(page.getByRole("button", { name: "Open register" })).toBeVisible();
  });
  test("register opened toast on sell", async ({ page }) => {
    await capture(page, "ux-04-register-opened.html", "ux-04-register-opened-1920.png", { width: 1920, height: 901 });
    await expect(page.getByText("Register opened.")).toBeVisible();
    await expect(page.getByText("Shift open")).toBeVisible();
  });
  test("orders desktop", async ({ page }) => {
    await capture(page, "ux-04-orders.html", "ux-04-orders-1920.png", { width: 1920, height: 868 });
    await expect(page.getByText("New sale")).toBeVisible();
  });
  test("customers desktop", async ({ page }) => {
    await capture(page, "ux-04-customers.html", "ux-04-customers-1920.png", { width: 1920, height: 868 });
    await expect(page.getByText("Use for next sale").first()).toBeVisible();
  });
  test("returns desktop", async ({ page }) => {
    await capture(page, "ux-04-returns.html", "ux-04-returns-1920.png", { width: 1920, height: 868 });
    await expect(page.getByText("Return items").first()).toBeVisible();
  });
  test("settings phone", async ({ page }) => {
    await capture(page, "ux-04-settings.html", "ux-04-settings-390.png", { width: 390, height: 844 });
  });
  test("orders tablet", async ({ page }) => {
    await capture(page, "ux-04-orders.html", "ux-04-orders-768.png", { width: 768, height: 1024 });
  });
  test("customers phone", async ({ page }) => {
    await capture(page, "ux-04-customers.html", "ux-04-customers-390.png", { width: 390, height: 844 });
  });
  test("returns phone", async ({ page }) => {
    await capture(page, "ux-04-returns.html", "ux-04-returns-390.png", { width: 390, height: 844 });
  });
  test("orders phone", async ({ page }) => {
    await capture(page, "ux-04-orders.html", "ux-04-orders-390.png", { width: 390, height: 844 });
  });
  test("register phone", async ({ page }) => {
    await capture(page, "ux-04-register.html", "ux-04-register-390.png", { width: 390, height: 844 });
  });
  test("health phone", async ({ page }) => {
    await capture(page, "ux-04-health.html", "ux-04-health-390.png", { width: 390, height: 844 });
  });
});
