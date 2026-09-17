import { expect, test } from "@playwright/test";
import { installAuthoritativeStaffSession } from "./staff-session";

test("/returns mounts the accepted Returns UI instead of the R4 placeholder", async ({ page }) => {
  await installAuthoritativeStaffSession(page);
  await page.goto("/returns");
  await expect(page.getByRole("heading", { level: 1, name: "Returns" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("This workspace is not part of the R4 Sell runtime.")).toHaveCount(0);
});

test("/register mounts the accepted Register UI instead of the R4 placeholder", async ({ page }) => {
  await installAuthoritativeStaffSession(page, { shiftOpen: false });
  await page.goto("/register");
  await expect(page.getByRole("button", { name: "Open register" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("This workspace is not part of the R4 Sell runtime.")).toHaveCount(0);
  await expect(page.locator('input[name="expectedCash"]')).toHaveCount(0);
});
