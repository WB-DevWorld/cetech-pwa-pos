import { expect, test } from "@playwright/test";
import { installAuthoritativeStaffSession } from "./staff-session";

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

test("authenticated approved workspaces are mounted instead of the R4 placeholder", async ({ page }) => {
  await installAuthoritativeStaffSession(page);
  for (const path of ["/orders", "/customers", "/settings", "/health", "/attention"] as const) {
    await page.goto(path);
    await expect(page.getByText("Cashier A")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("This workspace is not part of the R4 Sell runtime.")).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
});
