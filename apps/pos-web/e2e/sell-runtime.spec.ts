import { expect, test } from "@playwright/test";

test("Sell runtime restores workspace once and cart edits do not restore again", async ({ page }) => {
  await page.goto("/sell");
  await expect(page.getByRole("heading", { level: 1, name: "Sell" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-sell-restore-count]")).toHaveAttribute("data-sell-restore-count", "1");
  await expect(page.getByText("Loading catalog…")).toHaveCount(0);

  await page.locator("#product-search").fill("0012345678901");
  await page.getByRole("button", { name: "Scan" }).click();
  const cart = page.getByRole("complementary", { name: "Current cart" });
  await expect(cart.getByText("Epoxy Hardener 1L")).toBeVisible();
  const qty = cart.locator(".qty-input");
  await expect(qty).toHaveValue("1");

  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(qty).toHaveValue("2");
  await expect.poll(async () => page.locator("[data-sell-restore-count]").getAttribute("data-sell-restore-count"), {
    timeout: 3_000,
  }).toBe("1");
  await expect(qty).toHaveValue("2");
  await expect(page.getByRole("heading", { level: 1, name: "Sell" })).toBeVisible();
  await expect(page.getByText("Loading catalog…")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Sell" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("complementary", { name: "Current cart" }).locator(".qty-input")).toHaveValue("2");
  await expect(page.locator("[data-sell-restore-count]")).toHaveAttribute("data-sell-restore-count", "1");
});

test("same-revision quote revalidation reaches changed and blocks checkout", async ({ page }) => {
  const quoteControl = { fingerprint: "fp-a", delayMs: 0 };
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
    if (quoteControl.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, quoteControl.delayMs));
    }
    const total = quoteControl.fingerprint === "fp-a" ? 1500 : 1800;
    const correlationId = route.request().headers()["x-correlation-id"] ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        correlationId,
        data: quotePayload(posted, quoteControl.fingerprint, total),
      }),
    });
  });

  await page.goto("/sell");
  await expect(page.getByRole("heading", { level: 1, name: "Sell" })).toBeVisible({ timeout: 30_000 });
  await page.locator("#product-search").fill("0012345678901");
  await page.getByRole("button", { name: "Scan" }).click();
  await expect(page.locator("[data-quote-status='confirmed']")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-quote-status='confirmed']")).toContainText("GHS 15.00");

  await page.context().setOffline(true);
  await expect(page.locator("[data-quote-status='offline']")).toBeVisible();
  await expect(page.locator("[data-eligibility-allowed='false']")).toBeVisible();
  await expect(page.locator("[data-eligibility-reason='CONNECTION_REQUIRED']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay" })).toBeDisabled();

  quoteControl.fingerprint = "fp-b";
  quoteControl.delayMs = 800;
  await page.context().setOffline(false);
  await expect(page.locator("[data-quote-status='quoting']")).toBeVisible();
  await expect(page.locator("[data-eligibility-allowed='false']")).toBeVisible();
  await expect(page.locator("[data-eligibility-reason='QUOTE_REQUIRED']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay" })).toBeDisabled();

  await expect(page.locator("[data-quote-status='changed']")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-quote-status='changed']")).toContainText("Previous quoted total");
  await expect(page.locator("[data-quote-status='changed']")).toContainText("GHS 15.00");
  await expect(page.locator("[data-quote-status='changed']")).toContainText("Current quoted total");
  await expect(page.locator("[data-quote-status='changed']")).toContainText("GHS 18.00");
  await expect(page.locator("[data-eligibility-allowed='false']")).toBeVisible();
  await expect(page.locator("[data-eligibility-reason='QUOTE_REQUIRED']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay" })).toBeDisabled();
});

function quotePayload(
  request: {
    cartId: string;
    cartRevision: number;
    customer: { kind: "walkin" | "retail" | "b2b"; customerId?: string };
    locationId: string;
    lines: Array<{ lineId: string; productId: string; quantity: string; variationId?: string }>;
  },
  fingerprint: string,
  totalMinor: number,
) {
  const money = { minor: totalMinor, currency: "GHS" };
  return {
    id: fingerprint === "fp-a" ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    fingerprint,
    cartId: request.cartId,
    cartRevision: request.cartRevision,
    customer: request.customer,
    locationId: request.locationId,
    currency: "GHS",
    lines: request.lines.map((line) => ({
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
  };
}
