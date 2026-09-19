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
    throw new Error(
      `Missing ${path}. Run the FE-02 Vitest harness first so it writes HTML evidence.`,
    );
  }
  return readFileSync(path, "utf8");
}

async function openHarness(page: Page, html: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.setContent(html, { waitUntil: "load" });
}

test.describe("FE-02 visual harness (shell, login, register)", () => {
  test("desktop shell keeps a persistent navigation rail", async ({ page }) => {
    await openHarness(page, readEvidence("shell-desktop.html"), { width: 1440, height: 900 });

    const sidebar = page.locator(".sidebar");
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeAttached();
    await expect(skipLink).not.toBeFocused();
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await expect(page.getByRole("button", { name: "Sell" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("CETECH POS")).toBeVisible();
    await expect(page.getByText("Demo controls")).toHaveCount(0);

    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).toBeTruthy();
    expect(sidebarBox!.x).toBeLessThan(20);
    expect(sidebarBox!.y).toBeLessThan(20);

    await page.screenshot({
      path: resolve(evidenceDir, "shell-desktop.png"),
      fullPage: true,
    });
  });

  test("tablet shell keeps the rail and hides the secondary cashier pill", async ({ page }) => {
    await openHarness(page, readEvidence("shell-desktop.html"), { width: 900, height: 800 });

    const sidebar = page.locator(".sidebar");
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole("button", { name: "Sell" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(page.locator(".context-pill.secondary")).toBeHidden();

    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox).toBeTruthy();
    expect(sidebarBox!.x).toBeLessThan(20);

    await page.screenshot({
      path: resolve(evidenceDir, "shell-tablet.png"),
      fullPage: true,
    });
  });

  test("phone shell uses bottom navigation and hides Settings in the rail", async ({ page }) => {
    await openHarness(page, readEvidence("shell-desktop.html"), { width: 390, height: 844 });

    const sidebar = page.locator(".sidebar");
    await expect(sidebar).toBeVisible();
    const sell = page.getByRole("button", { name: "Sell" });
    await expect(sell).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" })).toBeHidden();
    await expect(page.locator(".brand-mark")).toBeHidden();
    await expect(page.getByText("CETECH POS")).toBeHidden();
    await expect(page.locator('[data-online="true"]')).toHaveAccessibleName("Online");
    const sellBox = await sell.boundingBox();
    expect(sellBox).toBeTruthy();
    expect(sellBox!.height).toBeGreaterThanOrEqual(44);

    const sidebarBox = await sidebar.boundingBox();
    const viewport = page.viewportSize();
    expect(sidebarBox).toBeTruthy();
    expect(viewport).toBeTruthy();
    expect(sidebarBox!.y).toBeGreaterThan(viewport!.height * 0.7);

    await page.screenshot({
      path: resolve(evidenceDir, "shell-phone.png"),
      fullPage: true,
    });
  });

  test("login gate has no fictional staff accounts", async ({ page }) => {
    await openHarness(page, readEvidence("login-desktop.html"), { width: 1440, height: 900 });

    await expect(page.getByRole("heading", { name: "CETECH POS" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Ama Mensah")).toHaveCount(0);
    await expect(page.getByText("Kofi Asare")).toHaveCount(0);

    const signIn = page.getByRole("button", { name: "Sign in" });
    const box = await signIn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await page.screenshot({
      path: resolve(evidenceDir, "login-desktop.png"),
      fullPage: true,
    });
  });

  test("open-register form treats opening float as money input", async ({ page }) => {
    await openHarness(page, readEvidence("register-desktop.html"), { width: 1440, height: 900 });

    await expect(page.getByRole("heading", { name: "Register", exact: true })).toBeVisible();
    await expect(page.getByLabel("Opening cash")).toHaveValue("500.00");
    await expect(page.getByRole("button", { name: "Open register" })).toBeVisible();
    await expect(page.getByText("staffId")).toHaveCount(0);

    const submit = page.getByRole("button", { name: "Open register" });
    const box = await submit.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await page.screenshot({
      path: resolve(evidenceDir, "register-desktop.png"),
      fullPage: true,
    });
  });
});
