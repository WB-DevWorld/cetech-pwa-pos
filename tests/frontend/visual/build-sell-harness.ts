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
  applySelectCustomer,
  createSellWorkspace,
  type SellWorkspaceDeps,
} from "../../../apps/pos-web/src/features/sell/state/sellWorkspace";
import type { SellWorkspaceState } from "../../../apps/pos-web/src/features/sell/state/sellView";

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

function wrap(state: SellWorkspaceState, extras?: { catalogAvailability?: SellWorkspaceState["catalogAvailability"]; draftStatus?: SellWorkspaceState["draftStatus"] }) {
  const body = renderToStaticMarkup(
    createElement(AppShell, {
      activeRoute: "sell",
      registerName: "Front Counter 1",
      cashierDisplayName: "Staff member",
      shiftOpen: true,
      online: extras?.catalogAvailability !== "offline" && extras?.catalogAvailability !== "offline_cached",
      attentionCount: 0,
      children: createElement(SellScreen, {
        catalog: SELL_TEST_CATALOG,
        customers: SELL_TEST_CUSTOMERS,
        initialState: state,
        catalogAvailability: extras?.catalogAvailability,
        draftStatus: extras?.draftStatus,
        createCartId: deps.createCartId,
        createLineId: deps.createLineId,
      }),
    }),
  );
  return documentFor("CETECH POS sell", body);
}

export function buildSellDesktopHarnessHtml(): string {
  let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
  state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, deps);
  return wrap(state);
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
