import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "../../../apps/pos-web/src/ui/shell/AppShell";
import { SellScreen } from "../../../apps/pos-web/src/features/sell/SellScreen";
import { SELL_TEST_CATALOG, SELL_TEST_CUSTOMERS } from "../../../apps/pos-web/src/features/sell/state/sellTestCatalog";
import {
  applyBarcodeScan,
  applyCatalogAvailability,
  applyDraftStatus,
  applyMobileCartOpen,
  applyProductSelect,
  applyQuantityIncrement,
  applySelectCustomer,
  createSellWorkspace,
  type SellWorkspaceDeps,
} from "../../../apps/pos-web/src/features/sell/state/sellWorkspace";
import type { SellProductView, SellWorkspaceState } from "../../../apps/pos-web/src/features/sell/state/sellView";
import type { CheckoutEligibilityView, QuoteDisplayState } from "../../../apps/pos-web/src/features/sell/state/quotePresentation";

export function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(resolve(dir, "apps/pos-web/src/ui/tokens.css"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error(`Unable to locate repository root from ${process.cwd()}`);
}

const repoRoot = findRepoRoot();

function css(relative: string): string {
  return readFileSync(resolve(repoRoot, relative), "utf8");
}

function documentFor(title: string, body: string): string {
  const styles = [
    css("apps/pos-web/src/ui/tokens.css"),
    css("apps/pos-web/src/ui/shell/shell.css"),
    css("apps/pos-web/src/features/auth/auth.css"),
    css("apps/pos-web/src/features/register/register.css"),
    css("apps/pos-web/src/features/sell/sell.css"),
  ].join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>${styles}</style>
</head>
<body>${body}</body>
</html>`;
}

const deps: SellWorkspaceDeps = {
  createCartId: () => "cart-visual",
  createLineId: () => "line-visual",
};

function wrap(
  state: SellWorkspaceState,
  extras?: {
    catalog?: readonly SellProductView[];
    catalogAvailability?: SellWorkspaceState["catalogAvailability"];
    draftStatus?: SellWorkspaceState["draftStatus"];
    quote?: QuoteDisplayState;
    eligibility?: CheckoutEligibilityView;
    checkoutReady?: boolean;
  },
) {
  const body = renderToStaticMarkup(
    createElement(AppShell, {
      activeRoute: "sell",
      registerName: "Front Counter 1",
      cashierDisplayName: "Staff member",
      shiftOpen: extras?.eligibility && "reason" in extras.eligibility && extras.eligibility.reason === "NO_ACTIVE_SHIFT" ? false : true,
      online: extras?.catalogAvailability !== "offline" && extras?.catalogAvailability !== "offline_cached",
      attentionCount: 0,
      children: createElement(SellScreen, {
        catalog: extras?.catalog ?? SELL_TEST_CATALOG,
        customers: SELL_TEST_CUSTOMERS,
        initialState: state,
        catalogAvailability: extras?.catalogAvailability,
        draftStatus: extras?.draftStatus,
        quote: extras?.quote,
        eligibility: extras?.eligibility,
        checkoutReady: extras?.checkoutReady,
        createCartId: deps.createCartId,
        createLineId: deps.createLineId,
      }),
    }),
  );
  return documentFor("CETECH POS sell", body);
}

function confirmedQuote(state: SellWorkspaceState, minor: number): QuoteDisplayState {
  const money = { minor, currency: "GHS" as const };
  return {
    status: "confirmed",
    revision: state.cartRevision,
    quote: {
      total: money,
      subtotal: money,
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
      lines: state.lines.map((line) => ({
        lineId: line.lineId,
        unitPrice: money,
        total: money,
      })),
    },
  };
}

export function buildSellDesktopHarnessHtml(): string {
  let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
  state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, deps);
  return wrap(state, {
    quote: confirmedQuote(state, 15500),
    eligibility: { allowed: false, reason: "NO_ACTIVE_SHIFT", message: "Start your shift before taking payment." },
  });
}

export function buildSellOpenShiftHarnessHtml(): string {
  let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
  state = applyBarcodeScan(state, "0001112223334", SELL_TEST_CATALOG, deps);
  const lineId = state.lines[0]?.lineId;
  if (lineId) {
    state = applyQuantityIncrement(state, lineId);
  }
  const money = { minor: 97000, currency: "GHS" as const };
  const unit = { minor: 48500, currency: "GHS" as const };
  return wrap(state, {
    quote: {
      status: "confirmed",
      revision: state.cartRevision,
      quote: {
        total: money,
        subtotal: money,
        discount: { minor: 0, currency: "GHS" },
        tax: { minor: 0, currency: "GHS" },
        lines: state.lines.map((line) => ({
          lineId: line.lineId,
          unitPrice: unit,
          total: money,
        })),
      },
    },
    eligibility: { allowed: true },
    checkoutReady: true,
  });
}

export function buildSellPhoneHarnessHtml(): string {
  let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
  state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, deps);
  state = applyMobileCartOpen(state, true);
  return wrap(state);
}

export function buildSellVariationHarnessHtml(): string {
  let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
  state = applyBarcodeScan(state, "0011223344556", SELL_TEST_CATALOG, deps);
  return wrap(state);
}

export function buildSellUnknownBarcodeHarnessHtml(): string {
  let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
  state = applyBarcodeScan(state, "9999999999999", SELL_TEST_CATALOG, deps);
  return wrap(state);
}

export function buildSellCustomerHarnessHtml(): string {
  let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
  state = applyBarcodeScan(state, "0012345", SELL_TEST_CATALOG, deps);
  state = applySelectCustomer(state, SELL_TEST_CUSTOMERS[1]!);
  return wrap(state);
}

export function buildSellOfflineHarnessHtml(): string {
  let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
  state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, deps);
  state = applyCatalogAvailability(state, "offline_cached");
  state = applyDraftStatus(state, { retainedLocally: true });
  return wrap(state, { catalogAvailability: "offline_cached", draftStatus: { retainedLocally: true } });
}

function overflowCatalog(count: number): SellProductView[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p-overflow-${index}`,
    name: `Overflow product ${index + 1} with a longer cashier-facing title`,
    sku: `OV-${String(index + 1).padStart(3, "0")}`,
    barcodes: [`9${String(index).padStart(12, "0")}`],
    kind: "simple" as const,
    stockStatus: "in_stock" as const,
    displayPrice: { minor: 1000 + index, currency: "GHS" as const },
  }));
}

export function buildSellOverflowProductsHarnessHtml(): string {
  const catalog = overflowCatalog(40);
  const state = createSellWorkspace(deps, catalog);
  return wrap(state, { catalog });
}

export function buildSellOverflowCartHarnessHtml(): string {
  const catalog = overflowCatalog(16);
  let n = 0;
  const lineDeps: SellWorkspaceDeps = {
    createCartId: () => "cart-visual",
    createLineId: () => `line-overflow-${++n}`,
  };
  let state = createSellWorkspace(lineDeps, catalog);
  for (const item of catalog) {
    state = applyProductSelect(state, item, catalog, lineDeps);
  }
  return wrap(state, {
    catalog,
    quote: confirmedQuote(state, 16000),
    eligibility: { allowed: true },
  });
}
