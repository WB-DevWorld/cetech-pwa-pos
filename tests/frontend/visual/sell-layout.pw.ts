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

async function openHarness(page: Page, html: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.setContent(html, { waitUntil: "load" });
}

test.describe("UX-02 Sell workstation layout", () => {
  test("desktop product results scroll inside the workstation while Pay stays visible", async ({ page }) => {
    await openHarness(page, readEvidence("sell-overflow-products.html"), { width: 1920, height: 870 });
    const workspace = page.locator("#sell-workspace");
    const results = page.locator(".product-results");
    const pay = page.getByRole("button", { name: /^Pay/ });
    const totals = page.locator(".cart-footer");
    await expect(workspace).toBeVisible();
    await expect(pay).toBeVisible();
    const workspaceBox = await workspace.boundingBox();
    const payBox = await pay.boundingBox();
    const totalsBox = await totals.boundingBox();
    expect(workspaceBox).toBeTruthy();
    expect(payBox).toBeTruthy();
    expect(totalsBox).toBeTruthy();
    expect(workspaceBox!.height).toBeLessThanOrEqual(870);
    expect(payBox!.y + payBox!.height).toBeLessThanOrEqual(870);
    expect(totalsBox!.y + totalsBox!.height).toBeLessThanOrEqual(870);
    const overflow = await results.evaluate((node) => ({
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    }));
    expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
    const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(documentHeight).toBeLessThanOrEqual(1100);
  });

  test("many cart lines scroll independently of Total and Pay", async ({ page }) => {
    await openHarness(page, readEvidence("sell-overflow-cart.html"), { width: 1920, height: 870 });
    const lines = page.locator(".cart-lines");
    const pay = page.getByRole("button", { name: /Pay/ });
    const total = page.locator(".summary-row.total");
    await expect(pay).toBeVisible();
    await expect(total).toBeVisible();
    const overflow = await lines.evaluate((node) => ({
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    }));
    expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
    const payBox = await pay.boundingBox();
    const totalBox = await total.boundingBox();
    expect(payBox!.y + payBox!.height).toBeLessThanOrEqual(870);
    expect(totalBox!.y + totalBox!.height).toBeLessThanOrEqual(870);
  });

  test("closed-shift desktop target viewport keeps search-first hierarchy", async ({ page }) => {
    await openHarness(page, readEvidence("sell-desktop.html"), { width: 1920, height: 901 });
    await expect(page.locator("#product-search")).toBeVisible();
    await expect(page.getByRole("button", { name: "Scan", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "F2 Search" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear", exact: true })).toBeVisible();
    await expect(page.getByText("Price confirmed")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pay/ })).toBeDisabled();
    await expect(page.getByText("Start your shift before taking payment.")).toBeVisible();
    await expect(page.locator(".page-head")).toHaveCount(0);
    await page.screenshot({ path: resolve(evidenceDir, "sell-desktop-closed-1920.png") });
  });

  test("open-shift desktop target viewport pins totals and active Pay", async ({ page }) => {
    await openHarness(page, readEvidence("sell-desktop-open.html"), { width: 1917, height: 870 });
    await expect(page.getByText("Shift open")).toBeVisible();
    await expect(page.getByText("Price confirmed")).toBeVisible();
    await expect(page.getByText("GHS 485.00 each")).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay GHS 970.00" })).toBeEnabled();
    const payBox = await page.getByRole("button", { name: "Pay GHS 970.00" }).boundingBox();
    expect(payBox!.y + payBox!.height).toBeLessThanOrEqual(870);
    await page.screenshot({ path: resolve(evidenceDir, "sell-desktop-open-1917.png") });
  });

  test("compact desktop still uses an internal product pane rather than a long document", async ({ page }) => {
    await openHarness(page, readEvidence("sell-overflow-products.html"), { width: 1172, height: 800 });
    const results = page.locator(".product-results");
    const overflow = await results.evaluate((node) => ({
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
    }));
    expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);
    const documentHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(documentHeight).toBeLessThanOrEqual(1000);
    await page.screenshot({ path: resolve(evidenceDir, "sell-compact-1172.png") });
  });

  test("tablet split stays two-pane at 1024 and becomes a cart overlay at 768", async ({ page }) => {
    await openHarness(page, readEvidence("sell-desktop.html"), { width: 1024, height: 768 });
    const products = await page.locator(".sell-products").boundingBox();
    const cart = await page.locator(".cart-panel").boundingBox();
    expect(products).toBeTruthy();
    expect(cart).toBeTruthy();
    expect(cart!.x).toBeGreaterThan(products!.x + products!.width - 12);
    await page.screenshot({ path: resolve(evidenceDir, "sell-tablet-1024.png") });

    await openHarness(page, readEvidence("sell-desktop.html"), { width: 768, height: 1024 });
    await expect(page.locator(".mobile-cart-bar")).toBeVisible();
    await expect(page.locator(".cart-panel")).toBeHidden();
    await page.screenshot({ path: resolve(evidenceDir, "sell-tablet-768.png") });
  });

  test("phone uses the cart overlay instead of a squeezed desktop split", async ({ page }) => {
    await openHarness(page, readEvidence("sell-phone.html"), { width: 390, height: 844 });
    await expect(page.getByRole("complementary", { name: "Current sale" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    const products = await page.locator(".sell-products").boundingBox();
    const cart = await page.locator(".cart-panel").boundingBox();
    expect(products).toBeTruthy();
    expect(cart).toBeTruthy();
    expect(Math.abs(cart!.x - products!.x)).toBeLessThan(24);
    await page.screenshot({ path: resolve(evidenceDir, "sell-phone-390.png") });
  });
});
