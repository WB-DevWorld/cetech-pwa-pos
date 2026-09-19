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

function assertTwoPaneSplit(products: { x: number; y: number; width: number; height: number }, cart: { x: number; y: number; width: number; height: number }) {
  expect(Math.abs(products.y - cart.y)).toBeLessThan(48);
  expect(cart.x).toBeGreaterThan(products.x + products.width - 12);
  expect(cart.y + 24).toBeLessThan(products.y + products.height);
}

test.describe("FE-03 isolated Sell visual harness", () => {
  test("desktop Sell workspace keeps products left and cart right on the same row", async ({ page }) => {
    await openHarness(page, readEvidence("sell-desktop.html"), { width: 1440, height: 900 });
    await expect(page.getByRole("heading", { name: "Sell" })).toHaveCount(1);
    await expect(page.getByLabel("Barcode, SKU or product name")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Current sale" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay" })).toBeDisabled();
    await expect(page.getByText("Demo controls")).toHaveCount(0);
    const search = page.getByLabel("Barcode, SKU or product name");
    const box = await search.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);

    const products = await page.locator(".sell-products").boundingBox();
    const cart = await page.locator(".cart-panel").boundingBox();
    expect(products).toBeTruthy();
    expect(cart).toBeTruthy();
    assertTwoPaneSplit(products!, cart!);

    await page.screenshot({ path: resolve(evidenceDir, "sell-desktop.png"), fullPage: true });
  });

  test("tablet Sell workspace keeps the two-pane split", async ({ page }) => {
    await openHarness(page, readEvidence("sell-tablet.html"), { width: 900, height: 800 });
    const products = await page.locator(".sell-products").boundingBox();
    const cart = await page.locator(".cart-panel").boundingBox();
    expect(products).toBeTruthy();
    expect(cart).toBeTruthy();
    assertTwoPaneSplit(products!, cart!);
    await expect(page.getByRole("button", { name: "Pay" })).toBeDisabled();
    await page.screenshot({ path: resolve(evidenceDir, "sell-tablet.png"), fullPage: true });
  });

  test("phone Sell workspace uses the cart overlay, not a squeezed desktop split", async ({ page }) => {
    await openHarness(page, readEvidence("sell-phone.html"), { width: 390, height: 844 });
    const cart = page.getByRole("complementary", { name: "Current sale" });
    await expect(cart).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    const back = page.getByRole("button", { name: "Back" });
    const box = await back.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: resolve(evidenceDir, "sell-phone.png"), fullPage: true });
  });

  test("variation chooser is visible and does not invent prices", async ({ page }) => {
    await openHarness(page, readEvidence("sell-variation.html"), { width: 1440, height: 900 });
    await expect(page.getByRole("heading", { name: "Choose variation" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Red/ })).toBeVisible();
    await expect(page.locator(".sell-dialog")).not.toContainText("GHS");
    await page.screenshot({ path: resolve(evidenceDir, "sell-variation.png"), fullPage: true });
  });

  test("unknown barcode is a non-blocking toast", async ({ page }) => {
    await openHarness(page, readEvidence("sell-unknown-barcode.html"), { width: 1440, height: 900 });
    await expect(page.locator("[data-sell-toast='unknown-barcode']")).toContainText("Product not found for barcode");
    await expect(page.locator("[data-sell-toast='unknown-barcode']")).toContainText("9999999999999");
    await expect(page.locator(".sell-dialog")).toHaveCount(0);
    await page.screenshot({ path: resolve(evidenceDir, "sell-unknown-barcode.png"), fullPage: true });
  });

  test("selected b2b customer shows Wholesale as display context only", async ({ page }) => {
    await openHarness(page, readEvidence("sell-customer.html"), { width: 1440, height: 900 });
    await expect(page.getByText("Buildworks Ltd")).toBeVisible();
    await expect(page.getByText("Wholesale")).toBeVisible();
    await expect(page.getByText("pricingKey")).toHaveCount(0);
    await page.screenshot({ path: resolve(evidenceDir, "sell-customer.png"), fullPage: true });
  });

  test("offline cached catalog copy stays operator-facing", async ({ page }) => {
    await openHarness(page, readEvidence("sell-offline.html"), { width: 1440, height: 900 });
    await expect(page.getByText("Saved products are available")).toBeVisible();
    await expect(page.getByText("Saved on this device")).toBeVisible();
    await expect(page.getByText("later task")).toHaveCount(0);
    await expect(page.getByText("adapter")).toHaveCount(0);
    await page.screenshot({ path: resolve(evidenceDir, "sell-offline.png"), fullPage: true });
  });
});
