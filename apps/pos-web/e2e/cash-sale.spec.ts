import { expect, test, type Page } from "@playwright/test";
import { installAuthoritativeStaffSession } from "./staff-session";

const RETAIL_FP = "0123456789abcdef0123456789abcdef";
const B2B_FP = "abcdef0123456789abcdef0123456789";
const TX = "11111111-1111-4111-8111-111111111111";
const PAYMENT = "22222222-2222-4222-8222-222222222222";
const RECEIPT = "rcpt-11111111";

test("combined Sell UI completes a retail cash sale through mocked BFF routes exactly once", async ({ page }) => {
  const counts = { prepare: 0, cash: 0, finalize: 0, receipt: 0 };
  await installCheckoutRoutes(page, counts, "walkin");
  await installAuthoritativeStaffSession(page);
  await page.goto("/sell");
  await expect(page.getByRole("heading", { level: 1, name: "Sell" })).toBeVisible({ timeout: 30_000 });
  await scanHardener(page);
  await expect(page.locator("[data-quote-status='confirmed']")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Pay" })).toBeEnabled();
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page.locator("[data-checkout-stage='cash']")).toBeVisible();
  await page.getByRole("button", { name: "Exact" }).click();
  await page.getByRole("button", { name: "Confirm cash" }).click();
  await expect(page.locator("[data-checkout-stage='receipt_ready']")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("POS-woo-1")).toBeVisible();
  await expect(page.locator("[data-sale-completed='true']")).toBeVisible();
  expect(counts.prepare).toBe(1);
  expect(counts.cash).toBe(1);
  expect(counts.finalize).toBe(1);
  expect(counts.receipt).toBeGreaterThanOrEqual(1);
});

test("combined Sell UI completes a B2B cash sale using the authoritative quoted total", async ({ page }) => {
  const counts = { prepare: 0, cash: 0, finalize: 0, receipt: 0 };
  await installCheckoutRoutes(page, counts, "b2b");
  await installAuthoritativeStaffSession(page);
  await page.goto("/sell");
  await expect(page.getByRole("heading", { level: 1, name: "Sell" })).toBeVisible({ timeout: 30_000 });
  await page.locator(".customer-chip").click();
  await page.getByRole("button", { name: /Buildworks Ltd/ }).click();
  await scanHardener(page);
  await expect(page.locator("[data-quote-status='confirmed']")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-quote-status='confirmed']")).toContainText("GHS 12.00");
  await page.getByRole("button", { name: "Pay" }).click();
  await expect(page.locator("[data-checkout-due='prepared']")).toContainText("GHS 12.00");
  await page.getByRole("button", { name: "Exact" }).click();
  await page.getByRole("button", { name: "Confirm cash" }).click();
  await expect(page.locator("[data-checkout-stage='receipt_ready']")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-checkout-stage='receipt_ready']")).toContainText("Buildworks Ltd");
  expect(counts.prepare).toBe(1);
  expect(counts.finalize).toBe(1);
});

async function scanHardener(page: Page): Promise<void> {
  await page.locator("#product-search").fill("0012345678901");
  await page.getByRole("button", { name: "Scan" }).click();
}

async function installCheckoutRoutes(
  page: Page,
  counts: { prepare: number; cash: number; finalize: number; receipt: number },
  customerKind: "walkin" | "b2b",
): Promise<void> {
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
    const b2b = posted.customer.kind === "b2b" || customerKind === "b2b";
    const total = b2b ? 1200 : 1500;
    const fingerprint = b2b ? B2B_FP : RETAIL_FP;
    const correlationId = route.request().headers()["x-correlation-id"] ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        correlationId,
        data: quotePayload(posted, fingerprint, total, b2b ? "quote-b2b-1" : "quote-retail-1"),
      }),
    });
  });
  await page.route(/\/api\/pos\/v1\/sales\/[0-9a-fA-F-]{36}$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const correlationId = route.request().headers()["x-correlation-id"] ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const url = new URL(route.request().url());
    const transactionId = url.pathname.split("/").filter(Boolean).at(-1) ?? TX;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        correlationId,
        data: {
          transactionId,
          status: "completed",
          saleId: "woo-1",
          orderReference: "woo-1",
          receiptId: RECEIPT,
          paymentId: PAYMENT,
        },
      }),
    });
  });
  await page.route("**/api/pos/v1/sales/prepare", async (route) => {
    counts.prepare += 1;
    const correlationId = route.request().headers()["x-correlation-id"] ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const posted = route.request().postDataJSON() as { transactionId: string; quoteFingerprint: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        correlationId,
        data: {
          transactionId: posted.transactionId,
          saleId: "woo-1",
          orderReference: "woo-1",
          quoteFingerprint: posted.quoteFingerprint,
          total: { minor: posted.quoteFingerprint === B2B_FP ? 1200 : 1500, currency: "GHS" },
          status: "prepared",
          stockCommitment: "reserved",
          preparedAt: "2026-09-15T12:00:00.000Z",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      }),
    });
  });
  await page.route("**/api/pos/v1/payments/cash", async (route) => {
    counts.cash += 1;
    const correlationId = route.request().headers()["x-correlation-id"] ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const posted = route.request().postDataJSON() as { transactionId: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        correlationId,
        data: {
          transactionId: posted.transactionId,
          paymentId: PAYMENT,
          tender: "cash",
          status: "verified",
          amount: { minor: customerKind === "b2b" ? 1200 : 1500, currency: "GHS" },
          verifiedAt: "2026-09-15T12:01:00.000Z",
          nextAction: "none",
        },
      }),
    });
  });
  await page.route("**/api/pos/v1/sales/finalize", async (route) => {
    counts.finalize += 1;
    const correlationId = route.request().headers()["x-correlation-id"] ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const posted = route.request().postDataJSON() as { transactionId: string; paymentId: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        correlationId,
        data: {
          transactionId: posted.transactionId,
          status: "completed",
          saleId: "woo-1",
          orderReference: "woo-1",
          receiptId: RECEIPT,
          paymentId: posted.paymentId,
        },
      }),
    });
  });
  await page.route("**/api/pos/v1/receipts/**", async (route) => {
    counts.receipt += 1;
    const correlationId = route.request().headers()["x-correlation-id"] ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const total = customerKind === "b2b" ? 1200 : 1500;
    const url = new URL(route.request().url());
    const transactionId = url.pathname.split("/").filter(Boolean).at(-1) ?? TX;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        correlationId,
        data: {
          id: RECEIPT,
          transactionId,
          receiptNumber: "POS-woo-1",
          orderReference: "woo-1",
          issuedAt: "2026-09-15T12:02:00.000Z",
          locationName: "loc-front-1",
          registerName: "Front Counter 1",
          cashierName: "Staff member",
          customerLabel: customerKind === "b2b" ? "Buildworks Ltd" : "Walk-in",
          lines: [
            {
              name: "Epoxy Hardener 1L",
              quantity: "1",
              unitPrice: { minor: total, currency: "GHS" },
              subtotal: { minor: total, currency: "GHS" },
              discount: { minor: 0, currency: "GHS" },
              tax: { minor: 0, currency: "GHS" },
              total: { minor: total, currency: "GHS" },
            },
          ],
          subtotal: { minor: total, currency: "GHS" },
          discount: { minor: 0, currency: "GHS" },
          tax: { minor: 0, currency: "GHS" },
          total: { minor: total, currency: "GHS" },
          tender: "cash",
          cashReceived: { minor: total, currency: "GHS" },
          changeDue: { minor: 0, currency: "GHS" },
          documentKind: "operational_pos_receipt",
        },
      }),
    });
  });
}

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
  quoteId: string,
) {
  const money = { minor: totalMinor, currency: "GHS" };
  return {
    id: quoteId,
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
    calculatedAt: "2026-09-15T12:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    purchasable: true,
  };
}
