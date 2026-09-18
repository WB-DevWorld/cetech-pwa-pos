import { expect, test } from "@playwright/test";
import { installAuthoritativeStaffSession } from "./staff-session";

test.describe("Sell live workstation chrome", () => {
  test("search is first, Scan is absent, and Pay stays in the desktop viewport", async ({ page }) => {
    await installAuthoritativeStaffSession(page);
    await page.setViewportSize({ width: 1920, height: 870 });
    await page.goto("/sell");
    await expect(page.locator("#product-search")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Scan", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "F2 Search" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear", exact: true })).toBeVisible();
    await expect(page.locator(".page-head")).toHaveCount(0);
    const pay = page.getByRole("button", { name: /^Pay/ });
    await expect(pay).toBeVisible();
    const payBox = await pay.boundingBox();
    expect(payBox).toBeTruthy();
    expect(payBox!.y + payBox!.height).toBeLessThanOrEqual(870);
  });
});
