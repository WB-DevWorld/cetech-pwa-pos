import { expect, test, type Page } from "@playwright/test";
import { expectAuthoritativeShell, installAuthoritativeStaffSession } from "./staff-session";

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
  test.setTimeout(90_000);
  await installAuthoritativeStaffSession(page);
  const mounted = [
    { path: "/orders", heading: "Orders" },
    { path: "/customers", heading: "Customers" },
    { path: "/settings", heading: "Settings" },
    { path: "/health", heading: "Store Health" },
    { path: "/attention", heading: "Needs attention" },
  ] as const;
  for (const { path, heading } of mounted) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Cashier A")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("This workspace is not part of the R4 Sell runtime.")).toHaveCount(0);
  }
});

test("client-side POS navigation keeps the authenticated staff runtime mounted", async ({ page }) => {
  test.setTimeout(90_000);
  const harness = await installAuthoritativeStaffSession(page);
  await page.goto("/sell", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Sell" })).toBeVisible({ timeout: 15_000 });
  await expectAuthoritativeShell(page);
  await expect(page.getByRole("banner").getByText("Front Counter")).toBeVisible();

  const owner = page.locator('[data-pos-runtime-owner="true"]');
  await expect(owner).toHaveAttribute("data-staff-runtime-status", "ready");
  const restoreCount = await owner.getAttribute("data-staff-restore-count");
  const catalogCount = await owner.getAttribute("data-catalog-bootstrap-count");
  const sessionGets = harness.sessionGets();
  const catalogSyncs = harness.catalogSyncs();
  expect(Number(restoreCount)).toBeGreaterThan(0);
  expect(Number(catalogCount)).toBeGreaterThan(0);
  expect(sessionGets).toBeGreaterThan(0);

  const mounted = [
    { route: "orders", heading: "Orders" },
    { route: "customers", heading: "Customers" },
    { route: "returns", heading: "Returns" },
    { route: "register", heading: "Shift open" },
    { route: "health", heading: "Store Health" },
    { route: "attention", heading: "Needs attention" },
    { route: "settings", heading: "Settings" },
    { route: "sell", heading: "Sell" },
  ] as const;

  for (const { route, heading } of mounted) {
    await page.locator(`button.nav-btn[data-route="${route}"]`).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 15_000 });
    await expectNoStaffAuthGate(page);
    await expectAuthoritativeShell(page);
    await expect(page.getByRole("banner").getByText("Front Counter")).toBeVisible();
    await expect(owner).toHaveAttribute("data-staff-restore-count", restoreCount ?? "");
    await expect(owner).toHaveAttribute("data-catalog-bootstrap-count", catalogCount ?? "");
    await expect(owner).toHaveAttribute("data-staff-runtime-status", "ready");
    expect(harness.sessionGets()).toBe(sessionGets);
    expect(harness.catalogSyncs()).toBe(catalogSyncs);
  }
});

async function expectNoStaffAuthGate(page: Page): Promise<void> {
  await expect(page.locator(".staff-auth-gate")).toHaveCount(0);
  await expect(page.getByText("Staff sign-in")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Signing in…" })).toHaveCount(0);
  await expect(page.getByText("Signing in…")).toHaveCount(0);
}
