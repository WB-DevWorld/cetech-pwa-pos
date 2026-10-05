import { expect, test, type Page } from "@playwright/test";
import { installAuthoritativeStaffSession } from "./staff-session";

const HARDENER = "0012345678901";
const LEADING_ZERO = "0012345";
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type QuoteRequest = {
  cartId: string;
  cartRevision: number;
  customer: { kind: "walkin" | "retail" | "b2b"; customerId?: string };
  locationId: string;
  lines: Array<{ lineId: string; productId: string; quantity: string; variationId?: string }>;
};

type CatalogReadLock = {
  release: () => void;
  finished: Promise<void>;
  expired: boolean;
};

type LockWindow = Window & { __scannerCatalogReadLock?: CatalogReadLock };

// A readwrite transaction excludes competing readonly catalog transactions.
// It issues only get() requests: no fixture, cart, journal or catalog row changes.
// This delays the real native IndexedDB/Dexie lookup, without application hooks.
async function holdCatalogReads(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const target = window as LockWindow;
    if (target.__scannerCatalogReadLock) throw new Error("Catalog lock already held");
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("cetech-pos-local");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const transaction = db.transaction(["catalogItems", "barcodeIndex"], "readwrite");
        const store = transaction.objectStore("catalogItems");
        let finish!: () => void;
        let released = false;
        let ready = false;
        const lock: CatalogReadLock = {
          finished: new Promise<void>((done) => { finish = done; }),
          expired: false,
          release: () => {
            if (released) return;
            released = true;
            transaction.abort();
          },
        };
        target.__scannerCatalogReadLock = lock;
        // A failed test must never leave a transaction holding the catalog lock.
        const deadline = window.setTimeout(() => {
          lock.expired = true;
          lock.release();
        }, 8_000);
        const finished = () => {
          window.clearTimeout(deadline);
          db.close();
          finish();
        };
        transaction.onabort = finished;
        transaction.oncomplete = finished;
        transaction.onerror = () => {
          if (!released) reject(transaction.error);
        };
        const read = () => {
          if (released) return;
          const request = store.get("p-hardener");
          request.onsuccess = () => {
            if (!ready) {
              ready = true;
              resolve();
            }
            read();
          };
          request.onerror = () => {
            if (!released) reject(request.error);
          };
        };
        read();
      };
    });
  });
}

async function releaseCatalogReads(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const target = window as LockWindow;
    const lock = target.__scannerCatalogReadLock;
    if (!lock) return;
    lock.release();
    await lock.finished;
    delete target.__scannerCatalogReadLock;
    if (lock.expired) throw new Error("Catalog read lock exceeded its bounded lifetime");
  });
}

async function scan(page: Page, barcode: string): Promise<void> {
  await page.locator("#product-search").evaluate((input) => (input as HTMLInputElement).blur());
  await page.keyboard.type(barcode, { delay: 1 });
  await page.keyboard.press("Enter");
}

function quotePayload(request: QuoteRequest) {
  const money = (minor: number) => ({ minor, currency: "GHS" });
  const totalMinor = request.lines.reduce((total, line) => total + 1500 * Number(line.quantity), 0);
  return {
    id: CORRELATION,
    fingerprint: `scanner-${request.cartId}-${request.cartRevision}`,
    cartId: request.cartId,
    cartRevision: request.cartRevision,
    customer: request.customer,
    locationId: request.locationId,
    currency: "GHS",
    lines: request.lines.map((line) => ({
      ...line,
      unitPrice: money(1500),
      subtotal: money(1500 * Number(line.quantity)),
      discount: money(0),
      tax: money(0),
      total: money(1500 * Number(line.quantity)),
      stockStatus: "in_stock",
      purchasable: true,
      problems: [],
    })),
    subtotal: money(totalMinor),
    discount: money(0),
    tax: money(0),
    total: money(totalMinor),
    calculatedAt: new Date().toISOString(),
    expiresAt: "2099-01-01T00:00:00.000Z",
    purchasable: true,
  };
}

async function openSell(page: Page): Promise<{ quotes: QuoteRequest[]; prepares: () => number }> {
  const quotes: QuoteRequest[] = [];
  let prepares = 0;
  await page.route("**/api/pos/v1/quotes", async (route) => {
    const request = route.request().postDataJSON() as QuoteRequest;
    quotes.push(request);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, correlationId: CORRELATION, data: quotePayload(request) }),
    });
  });
  // Any accidental prepare is intercepted locally and cannot create an order.
  await page.route("**/api/pos/v1/sales/prepare", async (route) => {
    prepares += 1;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        correlationId: CORRELATION,
        error: { code: "INTEGRATION_UNAVAILABLE", message: "No commerce writes in scanner tests.", retryable: true, nextAction: "resolve" },
      }),
    });
  });
  await installAuthoritativeStaffSession(page);
  await page.goto("/sell");
  await expect(page.locator("#product-search")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Loading products…")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Epoxy Hardener 1L", exact: true })).toBeVisible();
  return { quotes, prepares: () => prepares };
}

test("overlapping native catalog lookups retain both distinct keyboard scans in order", async ({ page }) => {
  const fixture = await openSell(page);
  const cart = page.getByRole("complementary", { name: "Current sale" });
  await holdCatalogReads(page);
  try {
    await scan(page, HARDENER);
    await scan(page, LEADING_ZERO);
    await expect(cart.locator(".cart-line")).toHaveCount(0);
  } finally {
    await releaseCatalogReads(page);
  }
  await expect(cart.locator(".cart-line-name")).toHaveText(["Epoxy Hardener 1L", "Leading-zero sample"]);
  await expect(cart.locator(".qty-input").nth(0)).toHaveValue("1");
  await expect(cart.locator(".qty-input").nth(1)).toHaveValue("1");
  await expect(page.locator("[data-quote-status='confirmed']")).toBeVisible();
  const lastQuote = fixture.quotes.at(-1);
  expect(lastQuote?.cartRevision).toBe(2);
  expect(lastQuote?.lines.map((line) => line.productId)).toEqual(["p-hardener", "p-leading-zero"]);
  expect(fixture.prepares()).toBe(0);
});

test("two overlapping scans of the same barcode increment quantity twice", async ({ page }) => {
  const fixture = await openSell(page);
  const cart = page.getByRole("complementary", { name: "Current sale" });
  await holdCatalogReads(page);
  try {
    await scan(page, HARDENER);
    await scan(page, HARDENER);
  } finally {
    await releaseCatalogReads(page);
  }
  await expect(cart.locator(".cart-line-name")).toHaveText(["Epoxy Hardener 1L"]);
  await expect(cart.locator(".qty-input")).toHaveValue("2");
  await expect(page.locator("[data-quote-status='confirmed']")).toBeVisible();
  expect(fixture.quotes.at(-1)).toMatchObject({ cartRevision: 2, lines: [{ productId: "p-hardener", quantity: "2" }] });
  expect(fixture.prepares()).toBe(0);
});

test("an accepted unresolved scan blocks Pay even before its next React render", async ({ page }) => {
  const fixture = await openSell(page);
  await scan(page, HARDENER);
  await expect(page.locator("[data-quote-status='confirmed']")).toBeVisible();
  const pay = page.getByRole("button", { name: /^Pay/ });
  await expect(pay).toBeEnabled();
  await holdCatalogReads(page);
  try {
    // Keep scan acceptance and the old enabled button's click in one browser
    // task. A handler guard is necessary before React can paint disabled state.
    await page.evaluate((barcode) => {
      (document.activeElement as HTMLElement | null)?.blur();
      const button = [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find((candidate) => /^Pay/.test(candidate.textContent?.trim() ?? ""));
      for (const key of [...barcode, "Enter"]) {
        document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      }
      button?.click();
    }, LEADING_ZERO);
    await expect(pay).toBeDisabled();
    await expect(page.getByRole("dialog", { name: "Checking price and stock…" })).toHaveCount(0);
    expect(fixture.prepares()).toBe(0);
    await expect(page.getByText("Finish pending barcode scans before paying.")).toBeVisible();
  } finally {
    await releaseCatalogReads(page);
  }
  await expect(page.getByRole("complementary", { name: "Current sale" }).locator(".cart-line-name"))
    .toHaveText(["Epoxy Hardener 1L", "Leading-zero sample"]);
  await expect(page.locator("[data-quote-status='confirmed']")).toBeVisible();
  await expect(pay).toBeEnabled();
  expect(fixture.prepares()).toBe(0);
  expect(fixture.quotes.at(-1)?.cartRevision).toBe(2);
});

for (const scenario of [
  { barcode: "0011223344556", dialog: "Choose variation", choice: /^Red/, firstLine: "Armoured Cable" },
  { barcode: "5550001112223", dialog: "Duplicate barcode match", choice: /^36W LED Panel Light/, firstLine: "36W LED Panel Light" },
]) {
  test(`queued scan waits for ${scenario.dialog.toLowerCase()} selection`, async ({ page }) => {
    const fixture = await openSell(page);
    const cart = page.getByRole("complementary", { name: "Current sale" });
    await holdCatalogReads(page);
    try {
      await scan(page, scenario.barcode);
      await scan(page, HARDENER);
    } finally {
      await releaseCatalogReads(page);
    }
    const dialog = page.getByRole("dialog", { name: scenario.dialog });
    await expect(dialog).toBeVisible();
    await expect(cart.locator(".cart-line")).toHaveCount(0);
    await dialog.getByRole("button", { name: scenario.choice }).click();
    await expect(dialog).toHaveCount(0);
    await expect(cart.locator(".cart-line-name")).toHaveText([scenario.firstLine, "Epoxy Hardener 1L"]);
    await expect(page.locator("[data-quote-status='confirmed']")).toBeVisible();
    expect(fixture.quotes.at(-1)?.cartRevision).toBe(2);
    expect(fixture.prepares()).toBe(0);
  });
}
