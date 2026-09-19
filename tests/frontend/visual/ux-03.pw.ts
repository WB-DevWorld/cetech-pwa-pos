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

test.describe("UX-03 payment, barcode, and variable-range visual evidence", () => {
  test("choose payment, cash, electronic waiting, collision, toast, and ranges", async ({ page }) => {
    await openHarness(page, readEvidence("ux-03-choose-payment.html"), { width: 1440, height: 900 });
    await expect(page.getByRole("heading", { name: "Choose payment" })).toBeVisible();
    await expect(page.locator("[data-prepared-order-reference]")).toContainText("POS-24111");
    await expect(page.locator('[data-tender="mobile_money"]')).toBeDisabled();
    await expect(page.getByText("Demo controls")).toHaveCount(0);
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-choose-payment-1440.png") });

    await openHarness(page, readEvidence("ux-03-choose-payment.html"), { width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "Choose payment" })).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-choose-payment-390.png") });

    await openHarness(page, readEvidence("ux-03-cash-empty.html"), { width: 1440, height: 900 });
    await expect(page.getByRole("heading", { name: "Cash payment" })).toBeVisible();
    await expect(page.getByText("Change due")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm cash" })).toBeDisabled();
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-cash-empty-1440.png") });

    await openHarness(page, readEvidence("ux-03-cash-change.html"), { width: 1440, height: 900 });
    await expect(page.locator("[data-change-due]")).toContainText("GHS 24.00");
    await expect(page.getByRole("button", { name: "Confirm cash" })).toBeEnabled();
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-cash-change-1440.png") });

    await openHarness(page, readEvidence("ux-03-cash-empty.html"), { width: 390, height: 844 });
    await expect(page.getByLabel("Cash received")).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-cash-empty-390.png") });

    await openHarness(page, readEvidence("ux-03-cash-large.html"), { width: 1440, height: 900 });
    await expect(page.locator("[data-checkout-due='prepared']")).toContainText("GHS 10,000,334.00");
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-cash-large-1440.png") });

    await openHarness(page, readEvidence("ux-03-electronic-waiting.html"), { width: 1440, height: 900 });
    await expect(page.getByText("Waiting for customer")).toBeVisible();
    await expect(page.getByText("Demo controls")).toHaveCount(0);
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-electronic-waiting-1440.png") });

    await openHarness(page, readEvidence("ux-03-electronic-pending.html"), { width: 1440, height: 900 });
    await expect(page.getByRole("dialog").getByRole("strong")).toHaveText("Do not charge again.");
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-electronic-pending-1440.png") });

    await openHarness(page, readEvidence("ux-03-collision.html"), { width: 1440, height: 900 });
    await expect(page.getByRole("heading", { name: "Duplicate barcode match" })).toBeVisible();
    await expect(page.locator(".collision-candidate").first()).toContainText("36W LED Panel Light");
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-collision-1440.png") });

    await openHarness(page, readEvidence("sell-unknown-barcode.html"), { width: 1440, height: 900 });
    await expect(page.locator("[data-sell-toast='unknown-barcode']")).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-unknown-toast-1440.png") });

    await openHarness(page, readEvidence("ux-03-variable-range.html"), { width: 1440, height: 900 });
    await expect(page.getByText("GHS 150.00")).toBeVisible();
    await expect(page.getByText("GHS 65.00 – GHS 567.00")).toBeVisible();
    await expect(page.getByText("Price unavailable")).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, "ux-03-variable-range-1440.png") });
  });
});
