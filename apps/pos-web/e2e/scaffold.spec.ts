import { expect, test } from "@playwright/test";
import { installAuthoritativeStaffSession } from "./staff-session";

test("Sell runtime mounts catalog search and keeps Pay disabled", async ({ page }) => {
  await installAuthoritativeStaffSession(page);
  await page.goto("/sell");
  await expect(page.locator("#product-search")).toBeVisible({ timeout: 30_000 });
  await page.locator("#product-search").fill("0012345678901");
  await page.locator("#product-search").press("Enter");
  await expect(
    page.getByRole("complementary", { name: "Current sale" }).getByText("Epoxy Hardener 1L"),
  ).toBeVisible();
  const pay = page.getByRole("button", { name: "Pay" });
  await expect(pay).toBeDisabled();
});
