import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "../../../apps/pos-web/src/ui/shell/AppShell";
import { SettingsScreen } from "../../../apps/pos-web/src/features/settings/SettingsScreen";
import { CustomersScreen } from "../../../apps/pos-web/src/features/customers/CustomersScreen";
import { OrdersScreen } from "../../../apps/pos-web/src/features/orders/OrdersScreen";
import { OpenRegisterForm } from "../../../apps/pos-web/src/features/register/OpenRegisterForm";
import { ReturnsScreen } from "../../../apps/pos-web/src/features/returns/ReturnsScreen";
import { idleReturnSession } from "../../../apps/pos-web/src/features/returns/returnView";
import { NeedsAttentionScreen, StoreHealthScreen } from "../../../apps/pos-web/src/ui/operational/OperationalSurfaces";
import type { StoreHealth } from "../../../docs/contracts/domain.generated";
import type { PosRoute } from "../../../apps/pos-web/src/ui/shell/routes";

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
    css("apps/pos-web/src/ui/workspace.css"),
    css("apps/pos-web/src/ui/operational/operational.css"),
    css("apps/pos-web/src/features/register/register.css"),
    css("apps/pos-web/src/features/orders/orders.css"),
    css("apps/pos-web/src/features/customers/customers.css"),
    css("apps/pos-web/src/features/settings/settings.css"),
    css("apps/pos-web/src/features/returns/returns.css"),
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

function wrap(route: PosRoute, children: ReactNode, shiftOpen = true): string {
  const body = renderToStaticMarkup(
    createElement(
      AppShell,
      {
        activeRoute: route,
        registerName: "Front Counter 1",
        cashierDisplayName: "Staff member",
        shiftOpen,
        online: true,
        attentionCount: 0,
      },
      children,
    ),
  );
  return documentFor(`CETECH POS baseline ${route}`, body);
}

const health: StoreHealth = {
  checks: [
    { id: "supabase", status: "healthy", message: "Connected", checkedAt: "2026-09-19T10:00:00.000Z" },
    { id: "bridge", status: "healthy", message: "Connected", checkedAt: "2026-09-19T10:00:00.000Z" },
    { id: "bridge-contract", status: "unverified", message: "pricingParityVerified=false", checkedAt: "2026-09-19T10:00:00.000Z" },
  ],
  contractVersion: "1.0.0",
  pendingOperationCount: 0,
  attentionCount: 0,
  buildId: "local-dev",
};

export function buildBaselineSettingsHtml(): string {
  return wrap(
    "settings",
    createElement(SettingsScreen, {
      settings: {
        deviceName: "local-dev-device",
        registerName: "Front Counter 1",
        scannerLabel: "Keyboard scanner input",
        printerLabel: "Browser print",
        appearance: "system",
        buildId: "local-dev",
        contractVersion: "1.0.0",
        localSchemaVersion: "4",
      },
      onOpenStoreHealth: () => undefined,
    }),
  );
}

export function buildBaselineAttentionHtml(): string {
  return wrap(
    "attention",
    createElement(NeedsAttentionScreen, {
      items: [
        {
          id: "shift-closed",
          title: "No open shift",
          summary: "Checkout stays blocked until an assigned register has an open shift.",
          typeLabel: "Register",
          severity: "low",
        },
      ],
    }),
  );
}

export function buildBaselineHealthHtml(): string {
  return wrap(
    "health",
    createElement(StoreHealthScreen, {
      health,
      deviceName: "local-dev-device",
      appVersion: "local-dev",
      localSchemaVersion: "4",
      onRebuildCatalog: () => undefined,
      onFixApp: () => undefined,
    }),
  );
}

export function buildBaselineRegisterHtml(): string {
  return wrap(
    "register",
    createElement(OpenRegisterForm, {
      registers: [{ id: "reg-1", name: "Front Counter 1", locationLabel: "Assigned location" }],
      selectedRegisterId: "reg-1",
      online: true,
      onSubmit: () => undefined,
    }),
    false,
  );
}

export function buildBaselineOrdersHtml(): string {
  return wrap("orders", createElement(OrdersScreen, { orders: [], onNewSale: () => undefined }));
}

export function buildBaselineCustomersHtml(): string {
  return wrap("customers", createElement(CustomersScreen, { customers: [] }));
}

export function buildBaselineReturnsHtml(): string {
  return wrap(
    "returns",
    createElement(ReturnsScreen, {
      session: idleReturnSession(),
      inFlight: false,
      lookup: { async search() { return []; } },
      onSelectSale: () => undefined,
      onUpdateLine: () => undefined,
      onPreview: () => undefined,
      onExecute: () => undefined,
      onResolve: () => undefined,
    }),
    false,
  );
}
