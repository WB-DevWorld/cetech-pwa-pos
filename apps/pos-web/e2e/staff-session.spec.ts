import { expect, test } from "@playwright/test";

test("unauthenticated POS does not claim staff or shift authority", async ({ page }) => {
  await page.route("**/api/pos/v1/session", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: {
          code: "AUTH_REQUIRED",
          message: "staff session is required",
          retryable: false,
          nextAction: "reauthenticate",
        },
        correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    });
  });
  await page.goto("/sell");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Staff member")).toHaveCount(0);
  await expect(page.getByText("Shift open")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Sell" })).toHaveCount(0);
});
