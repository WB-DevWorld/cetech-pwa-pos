import { expect, test } from "@playwright/test";

test("scaffold root page is visible in the browser", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "CETECH POS engineering scaffold",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("not the approved production POS UI", { exact: false }),
  ).toBeVisible();
});
