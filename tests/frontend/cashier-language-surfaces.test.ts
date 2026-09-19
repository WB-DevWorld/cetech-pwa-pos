import { createElement } from "react";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CartPanel } from "../../apps/pos-web/src/features/sell/components/CartPanel";
import { QuoteStatus } from "../../apps/pos-web/src/features/sell/components/QuoteStatus";
import { ElectronicPaymentPanel } from "../../apps/pos-web/src/features/payments/ElectronicPaymentPanel";
import { idleElectronicPaymentSession } from "../../apps/pos-web/src/features/payments/electronicPaymentView";
import { StoreHealthScreen, NeedsAttentionScreen, PassiveTabNotice } from "../../apps/pos-web/src/ui/operational/OperationalSurfaces";
import { SettingsScreen } from "../../apps/pos-web/src/features/settings/SettingsScreen";
import { LoginScreen } from "../../apps/pos-web/src/features/auth/LoginScreen";
import { StaffAuthGate } from "../../apps/pos-web/src/app/staff-auth-gate";
import { CustomersScreen } from "../../apps/pos-web/src/features/customers/CustomersScreen";
import { OrdersScreen } from "../../apps/pos-web/src/features/orders/OrdersScreen";
import { INTEGRATION_UNAVAILABLE } from "../../apps/pos-web/src/features/sell/state/quotePresentation";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const PROHIBITED = [
  "INTEGRATION_UNAVAILABLE",
  "Quoted total",
  "Quoted subtotal",
  "Quoted discount",
  "Quoted tax",
  "API contract",
  "Local schema",
  "WS3",
  "IndexedDB",
  "provider callback",
  "server-owned",
  "mounted source",
];

function visiblePrimaryText(html: string): string {
  return html
    .replace(/<details[\s\S]*?<\/details>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

function collectSource(dir: string): string {
  let out = "";
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "cashier-language") continue;
      out += collectSource(path);
    } else if (/\.(tsx|ts)$/.test(entry.name) && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) {
      out += readFileSync(path, "utf8");
    }
  }
  return out;
}

const emptyHandlers = {
  onOpenCustomers: () => undefined,
  onClear: () => undefined,
  onIncrement: () => undefined,
  onDecrement: () => undefined,
  onQuantityChange: () => undefined,
  onRemove: () => undefined,
  onCloseMobile: () => undefined,
};

describe("UX-01 cashier surfaces hide engineering vocabulary", () => {
  test("confirmed quote uses ordinary labels, shows zero discount, and Pay uses the quote total", () => {
    const html = renderToStaticMarkup(
      createElement(CartPanel, {
        revision: 1,
        lines: [{ lineId: "line-1", catalogItemId: "14985", name: "Adapter", sku: "14985", quantity: "1" }],
        customer: null,
        mobileOpen: false,
        quote: {
          status: "confirmed",
          revision: 1,
          quote: {
            total: { minor: 3000, currency: "GHS" },
            subtotal: { minor: 3000, currency: "GHS" },
            discount: { minor: 0, currency: "GHS" },
            tax: { minor: 0, currency: "GHS" },
          },
        },
        eligibility: { allowed: true },
        checkoutReady: true,
        onPay: () => undefined,
        ...emptyHandlers,
      }),
    );
    const primary = visiblePrimaryText(html);
    expect(html).toContain("Cart");
    expect(html).toContain("Rev 1");
    expect(html).toContain("Price confirmed");
    expect(html).not.toContain("Price ready");
    expect(html).toContain("Subtotal");
    expect(html).toContain("Discount");
    expect(html).toContain("Tax");
    expect(html).toContain("Total");
    expect(html).toContain("Pay GHS 30.00");
    expect(html).toContain("SKU 14985");
    expect(primary).not.toContain("Quoted total");
    expect(primary).not.toContain("Quoted discount");
    expect(html).toMatch(/>Discount</);
    expect(html).toContain('class="summary-row total"');
    expect(html).toContain('aria-live="polite"');
  });

  test("unavailable-line failure is actionable and does not print INTEGRATION_UNAVAILABLE in primary UI", () => {
    const html = renderToStaticMarkup(
      createElement(QuoteStatus, {
        quote: {
          status: "failed",
          revision: 1,
          code: INTEGRATION_UNAVAILABLE,
          message: "WooCommerce rejected a quote line.",
        },
        cartLineNames: ["Adapter", "Cable"],
      }),
    );
    const primary = visiblePrimaryText(html);
    expect(primary).toContain("One or more items can't be sold right now");
    expect(primary).not.toContain("INTEGRATION_UNAVAILABLE");
    expect(primary).not.toContain("WooCommerce");
    expect(html).toContain("Technical details");
    expect(html).toContain("INTEGRATION_UNAVAILABLE");
  });

  test("payment uncertainty still contains Do not charge again without provider-callback copy", () => {
    const html = renderToStaticMarkup(
      createElement(ElectronicPaymentPanel, {
        session: {
          ...idleElectronicPaymentSession(),
          status: "reconciling",
          nextAction: "resolve",
          doNotChargeAgain: true,
          resolveAllowed: true,
          presentAllowed: false,
          message: "We're checking this payment. Do not start another payment.",
          browserCallbackIsNotTruth: true,
        },
        inFlight: false,
        selectedTender: "mobile_money",
        onSelectedTenderChange: () => undefined,
        onPresent: () => undefined,
        onResolve: () => undefined,
        onContinueWaiting: () => undefined,
        onContactManager: () => undefined,
      }),
    );
    const primary = visiblePrimaryText(html);
    expect(primary).toContain("Do not charge again");
    expect(primary).not.toContain("provider callback");
    expect(primary).not.toContain("payment identity");
    expect(primary).not.toContain("Tender");
  });

  test("system status, settings, and sign-in keep technical fields inside Technical details", () => {
    const health = renderToStaticMarkup(
      createElement(StoreHealthScreen, {
        health: {
          checks: [
            {
              id: "bridge-contract",
              status: "degraded",
              message: "wooDetected=true woodmartDetected=true b2bkingDetected=true pricingParityVerified=false",
              checkedAt: "2026-09-18T10:00:00.000Z",
            },
          ],
          contractVersion: "1.0.0",
          pendingOperationCount: 0,
          attentionCount: 0,
          buildId: "abc123",
        },
        localSchemaVersion: "7",
        deviceName: "11111111-1111-4111-8111-111111111111",
      }),
    );
    const healthPrimary = visiblePrimaryText(health);
    expect(health).toContain("System status");
    expect(healthPrimary).toContain("Authoritative pricing");
    expect(healthPrimary).toContain("Pending verification");
    expect(healthPrimary).not.toContain("wooDetected=true");
    expect(health).toContain("API contract");

    const settings = renderToStaticMarkup(
      createElement(SettingsScreen, {
        settings: {
          deviceName: "11111111-1111-4111-8111-111111111111",
          registerName: "Register A",
          scannerLabel: "Attached scanner (presentation only)",
          printerLabel: "Receipt printer via PrintPort",
          appearance: "system",
          buildId: "abc",
          contractVersion: "1.0.0",
          localSchemaVersion: "7",
        },
        onOpenStoreHealth: () => undefined,
      }),
    );
    const settingsPrimary = visiblePrimaryText(settings);
    expect(settingsPrimary).toContain("This device");
    expect(settingsPrimary).toContain("Keyboard-wedge scanner");
    expect(settingsPrimary).toContain("Browser print (80mm/A4)");
    expect(settingsPrimary).not.toContain("Connected scanner");
    expect(settingsPrimary).not.toContain("API contract");
    expect(settingsPrimary).not.toContain("WS3");
    expect(settings).toContain("API contract");

    const login = renderToStaticMarkup(createElement(LoginScreen, { onSignIn: () => undefined }));
    expect(login).toContain("Staff sign-in");
    expect(login).toContain("Use your staff account to continue.");
    expect(login).not.toContain("IndexedDB");
    expect(login).not.toContain("Transitional staff identity");

    const attention = renderToStaticMarkup(createElement(NeedsAttentionScreen, { items: [] }));
    expect(attention).toContain("No issues need your attention.");
    expect(renderToStaticMarkup(createElement(PassiveTabNotice, { passive: true }))).toContain("This tab is read-only.");
  });

  test("raw backend messages never appear as primary copy on sign-in, settings, orders, or customers", () => {
    const unsafe = [
      "Supabase service role request failed",
      "provider runtime returned invalid envelope",
      "internal operation 123 failed",
      "staff session store is unavailable",
    ];
    const login = renderToStaticMarkup(
      createElement(StaffAuthGate, {
        noticeState: "signed_out",
        busy: false,
        errorMessage: unsafe[0],
        onSignIn: () => undefined,
      }),
    );
    const loginPrimary = visiblePrimaryText(login);
    expect(loginPrimary).toContain("Sign-in is temporarily unavailable");
    expect(loginPrimary).not.toContain("Supabase service role request failed");

    const settings = renderToStaticMarkup(
      createElement(SettingsScreen, {
        settings: {
          deviceName: "Counter tablet 1",
          registerName: "Register A",
          scannerLabel: "Attached scanner (presentation only)",
          printerLabel: "Receipt printer via PrintPort",
          appearance: "system",
          buildId: "abc",
          contractVersion: "1.0.0",
        },
        state: "error",
        errorMessage: unsafe[1],
      }),
    );
    const settingsPrimary = visiblePrimaryText(settings);
    expect(settingsPrimary).not.toContain("provider runtime returned invalid envelope");
    expect(settingsPrimary).toContain("This action couldn't be completed");

    const orders = renderToStaticMarkup(
      createElement(OrdersScreen, { orders: [], state: "error", errorMessage: unsafe[2] }),
    );
    expect(visiblePrimaryText(orders)).not.toContain("internal operation 123 failed");

    const customers = renderToStaticMarkup(
      createElement(CustomersScreen, { customers: [], state: "error", errorMessage: unsafe[3] }),
    );
    expect(visiblePrimaryText(customers)).not.toContain("staff session store is unavailable");
  });

  test("frontend presentation source does not move pricing or stock authority into the browser", () => {
    const source =
      collectSource(resolve(repoRoot, "apps/pos-web/src/features/sell/components")) +
      collectSource(resolve(repoRoot, "apps/pos-web/src/features/sell/state")) +
      collectSource(resolve(repoRoot, "apps/pos-web/src/ui/cashier-language"));
    expect(source).not.toMatch(/displayPrice\.minor\s*[+\-*/]/);
    expect(source).not.toMatch(/from ["']docs\/contracts/);
    expect(source).not.toContain("wc_get_price");
  });

  test("prohibited terms stay out of primary cashier markup for the sell cart", () => {
    const html = renderToStaticMarkup(
      createElement(CartPanel, {
        revision: 9,
        lines: [],
        customer: null,
        mobileOpen: false,
        ...emptyHandlers,
      }),
    );
    const primary = visiblePrimaryText(html);
    for (const term of PROHIBITED) {
      expect(primary).not.toContain(term);
    }
  });
});
