import { expect, type Page } from "@playwright/test";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION = {
  actorId: "cashier_a",
  displayName: "Cashier A",
  organizationId: "org_a",
  locationIds: ["loc_a1"],
  capabilities: ["ui.hint.only"],
  expiresAt: "2099-01-01T00:00:00.000Z",
};
const REGISTER = {
  id: "reg_a",
  name: "Front Counter",
  locationId: "loc_a1",
  currency: "GHS",
  status: "active",
};
const OPEN_SHIFT = {
  id: "s1111111-1111-4111-8111-111111111111",
  registerId: "reg_a",
  deviceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  cashierId: "cashier_a",
  status: "open",
  openingFloat: { minor: 50000, currency: "GHS" },
  openedAt: "2026-09-17T08:00:00.000Z",
};

export async function installAuthoritativeStaffSession(
  page: Page,
  options: { readonly shiftOpen?: boolean } = {},
): Promise<void> {
  const shiftOpen = options.shiftOpen ?? true;
  await page.route("**/api/pos/v1/session", async (route) => {
    const method = route.request().method();
    if (method === "GET" || method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          correlationId: CORRELATION,
          data: {
            session: SESSION,
            assignedLocationIds: ["loc_a1"],
            assignedRegisterIds: ["reg_a"],
          },
        }),
      });
      return;
    }
    if (method === "DELETE") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          correlationId: CORRELATION,
          data: { signedOut: true, localWorkPreserved: true },
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.route("**/api/pos/v1/registers/reg_a", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, correlationId: CORRELATION, data: REGISTER }),
    });
  });
  await page.route("**/api/pos/v1/registers/reg_a/active-shift", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        correlationId: CORRELATION,
        data: shiftOpen ? OPEN_SHIFT : null,
      }),
    });
  });
}

export async function expectAuthoritativeShell(page: Page, options: { readonly shiftOpen?: boolean } = {}): Promise<void> {
  await expect(page.getByText("Cashier A")).toBeVisible();
  await expect(page.getByText("Staff member")).toHaveCount(0);
  if (options.shiftOpen === false) {
    await expect(page.getByText("No open shift")).toBeVisible();
    await expect(page.getByText("Shift open")).toHaveCount(0);
  } else {
    await expect(page.getByText("Shift open")).toBeVisible();
  }
}
