import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { installAuthoritativeStaffSession } from "./staff-session";

const evidenceDir = resolve(__dirname, "../../../tests/frontend/evidence");

test.describe("UX-02 local integrated Sell runtime screenshots", () => {
  test("captures closed-shift, open-shift, compact, tablet, and phone workstations", async ({ page }) => {
    await installIdentityQuotes(page);

    await installAuthoritativeStaffSession(page, { shiftOpen: false });
    await page.setViewportSize({ width: 1920, height: 901 });
    await page.goto("/sell");
    await expect(page.locator("#product-search")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".product-card").filter({ hasText: "Epoxy Hardener 1L" })).toContainText("GHS 155.00");
    await expect(page.getByRole("button", { name: "Scan", exact: true })).toHaveCount(0);
    await expect(page.locator(".page-head")).toHaveCount(0);
    await page.screenshot({ path: resolve(evidenceDir, "ux-02-runtime-closed-1920x901.png") });

    await installAuthoritativeStaffSession(page, { shiftOpen: true });
    await page.setViewportSize({ width: 1917, height: 870 });
    await page.goto("/sell");
    await expect(page.locator("#product-search")).toBeVisible({ timeout: 30_000 });
    await page.locator("#product-search").fill("0012345678901");
    await page.locator("#product-search").press("Enter");
    await expect(page.locator("[data-quote-status='confirmed']")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Price confirmed")).toBeVisible();
    await expect(page.locator(".cart-totals")).toContainText("GHS 15.00");
    await expect(page.getByRole("button", { name: /^Pay/ })).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, "ux-02-runtime-open-1917x870.png") });

    await page.setViewportSize({ width: 1172, height: 800 });
    await expect(page.locator("#product-search")).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, "ux-02-runtime-compact-1172.png") });

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator(".cart-panel")).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, "ux-02-runtime-tablet-1024.png") });

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator(".mobile-cart-bar")).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, "ux-02-runtime-tablet-768.png") });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".mobile-cart-bar")).toBeVisible();
    await page.screenshot({ path: resolve(evidenceDir, "ux-02-runtime-phone-390.png") });
  });
});

async function installIdentityQuotes(page: Page): Promise<void> {
  await page.route("**/api/pos/v1/quotes", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const posted = route.request().postDataJSON() as {
      cartId: string;
      cartRevision: number;
      customer: { kind: "walkin" | "retail" | "b2b"; customerId?: string };
      locationId: string;
      lines: Array<{ lineId: string; productId: string; quantity: string; variationId?: string }>;
    };
    const money = { minor: 1500, currency: "GHS" };
    const correlationId = route.request().headers()["x-correlation-id"] ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        correlationId,
        data: {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          fingerprint: "fp-runtime-visual",
          cartId: posted.cartId,
          cartRevision: posted.cartRevision,
          customer: posted.customer,
          locationId: posted.locationId,
          currency: "GHS",
          lines: posted.lines.map((line) => ({
            lineId: line.lineId,
            productId: line.productId,
            variationId: line.variationId,
            quantity: line.quantity,
            unitPrice: money,
            subtotal: money,
            discount: { minor: 0, currency: "GHS" },
            tax: { minor: 0, currency: "GHS" },
            total: money,
            stockStatus: "in_stock",
            purchasable: true,
            problems: [],
          })),
          subtotal: money,
          discount: { minor: 0, currency: "GHS" },
          tax: { minor: 0, currency: "GHS" },
          total: money,
          calculatedAt: "2026-09-13T20:00:00.000Z",
          expiresAt: "2099-01-01T00:00:00.000Z",
          purchasable: true,
        },
      }),
    });
  });
}
