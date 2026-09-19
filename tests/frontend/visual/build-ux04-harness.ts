import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "../../../apps/pos-web/src/ui/shell/AppShell";
import { SettingsScreen } from "../../../apps/pos-web/src/features/settings/SettingsScreen";
import { CustomersScreen } from "../../../apps/pos-web/src/features/customers/CustomersScreen";
import { OrdersScreen, type OrderListItemView } from "../../../apps/pos-web/src/features/orders/OrdersScreen";
import { OpenRegisterForm } from "../../../apps/pos-web/src/features/register/OpenRegisterForm";
import { ReturnsScreen } from "../../../apps/pos-web/src/features/returns/ReturnsScreen";
import { idleReturnSession } from "../../../apps/pos-web/src/features/returns/returnView";
import {
  NeedsAttentionScreen,
  StoreHealthScreen,
  type AttentionItemView,
} from "../../../apps/pos-web/src/ui/operational/OperationalSurfaces";
import type { StoreHealth } from "../../../docs/contracts/domain.generated";
import type { PosRoute } from "../../../apps/pos-web/src/ui/shell/routes";
import { AppToast } from "../../../apps/pos-web/src/ui/toast/AppToast";
import { buildSellOpenShiftHarnessHtml } from "./build-sell-harness";

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
    css("apps/pos-web/src/ui/toast/toast.css"),
    css("apps/pos-web/src/features/register/register.css"),
    css("apps/pos-web/src/features/orders/orders.css"),
    css("apps/pos-web/src/features/customers/customers.css"),
    css("apps/pos-web/src/features/settings/settings.css"),
    css("apps/pos-web/src/features/returns/returns.css"),
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

function wrap(
  route: PosRoute,
  children: ReactNode,
  extras?: { shiftOpen?: boolean; attentionCount?: number; toast?: { title: string; detail?: string } },
): string {
  const body = renderToStaticMarkup(
    createElement(
      AppShell,
      {
        activeRoute: route,
        registerName: "Front Counter 1",
        cashierDisplayName: "Ama Mensah",
        shiftOpen: extras?.shiftOpen ?? true,
        online: true,
        attentionCount: extras?.attentionCount ?? 1,
      },
      extras?.toast
        ? createElement(
            "div",
            null,
            children,
            createElement(AppToast, { title: extras.toast.title, detail: extras.toast.detail, open: true }),
          )
        : children,
    ),
  );
  return documentFor(`CETECH POS ${route}`, body);
}

const fixtureHealth: StoreHealth = {
  checks: [
    { id: "internet", status: "healthy", message: "Connected", checkedAt: "2026-09-19T10:00:00.000Z" },
    { id: "commerce", status: "healthy", message: "Healthy", checkedAt: "2026-09-19T10:00:00.000Z" },
    { id: "pricing", status: "unverified", message: "pricingParityVerified=false", checkedAt: "2026-09-19T10:00:00.000Z" },
    { id: "catalog", status: "healthy", message: "Fresh", checkedAt: "2026-09-19T10:00:00.000Z" },
    { id: "payments", status: "unverified", message: "Electronic methods are not confirmed", checkedAt: "2026-09-19T10:00:00.000Z" },
    { id: "supabase", status: "healthy", message: "Healthy", checkedAt: "2026-09-19T10:00:00.000Z" },
    { id: "app-version", status: "healthy", message: "Supported", checkedAt: "2026-09-19T10:00:00.000Z" },
  ],
  contractVersion: "1.0.0",
  pendingOperationCount: 0,
  attentionCount: 1,
  buildId: "stg-01-c857b097",
};

const fixtureAttention: AttentionItemView = {
  id: "pay-pending-1",
  title: "Payment awaiting verification",
  summary: "A sample electronic payment is pending. Do not charge the customer again until it is resolved.",
  typeLabel: "payment",
  severity: "medium",
  transactionReference: "TX-PENDING-1",
  resolveAllowed: true,
  reviewAllowed: true,
};

const fixtureOrders: readonly OrderListItemView[] = [
  {
    id: "11111111-1111-4111-8111-111111111091",
    orderReference: "#24091",
    receiptNumber: "CT-00091",
    customerLabel: "Accra Buildworks Ltd",
    customerKind: "b2b",
    createdAt: "2026-09-10T15:12:00.000Z",
    paymentLabel: "Mobile Money",
    paymentStatus: "verified",
    total: { minor: 115000, currency: "GHS" },
    status: "completed",
    transactionReference: "11111111-1111-4111-8111-111111111091",
  },
  {
    id: "11111111-1111-4111-8111-111111111088",
    orderReference: "#24088",
    receiptNumber: "CT-00088",
    customerLabel: "Adwoa Mensah",
    customerKind: "retail",
    createdAt: "2026-09-10T12:08:00.000Z",
    paymentLabel: "Cash",
    paymentStatus: "verified",
    total: { minor: 42500, currency: "GHS" },
    status: "completed",
  },
];

export function buildUx04SettingsHtml(): string {
  return wrap(
    "settings",
    createElement(SettingsScreen, {
      settings: {
        deviceName: "Front Counter 1 terminal",
        registerName: "Front Counter 1",
        scannerLabel: "Keyboard-wedge scanner",
        printerLabel: "Browser print (80mm/A4)",
        appearance: "system",
        buildId: "stg-01-c857b097",
        contractVersion: "1.0.0",
        localSchemaVersion: "4",
      },
      onAppearanceChange: () => undefined,
      onOpenStoreHealth: () => undefined,
    }),
  );
}

export function buildUx04AttentionHtml(): string {
  return wrap(
    "attention",
    createElement(NeedsAttentionScreen, {
      items: [fixtureAttention],
      onResolveItem: () => undefined,
      onReviewItem: () => undefined,
    }),
    { attentionCount: 1 },
  );
}

export function buildUx04HealthHtml(): string {
  return wrap(
    "health",
    createElement(StoreHealthScreen, {
      health: fixtureHealth,
      deviceName: "Front Counter 1 terminal",
      appVersion: "stg-01-c857b097",
      localSchemaVersion: "4",
      online: true,
      catalogAvailability: "fresh",
      electronicPaymentsAvailable: false,
      onRebuildCatalog: () => undefined,
      onFixApp: () => undefined,
    }),
  );
}

export function buildUx04HealthToastHtml(): string {
  return wrap(
    "health",
    createElement(StoreHealthScreen, {
      health: fixtureHealth,
      deviceName: "Front Counter 1 terminal",
      appVersion: "stg-01-c857b097",
      localSchemaVersion: "4",
      online: true,
      catalogAvailability: "fresh",
      electronicPaymentsAvailable: false,
      onRebuildCatalog: () => undefined,
    }),
    {
      toast: {
        title: "Rebuildable catalog projection refreshed.",
        detail: "Durable cart was preserved.",
      },
    },
  );
}

export function buildUx04RegisterHtml(): string {
  return wrap(
    "register",
    createElement(OpenRegisterForm, {
      registers: [{ id: "reg-1", name: "Front Counter 1", locationLabel: "CETECH Main Store" }],
      selectedRegisterId: "reg-1",
      online: true,
      onSubmit: () => undefined,
    }),
    { shiftOpen: false, attentionCount: 1 },
  );
}

export function buildUx04OrdersHtml(): string {
  return wrap(
    "orders",
    createElement(OrdersScreen, {
      orders: fixtureOrders,
      onNewSale: () => undefined,
      onSelectOrder: () => undefined,
    }),
    { shiftOpen: false },
  );
}

export function buildUx04CustomersHtml(): string {
  return wrap(
    "customers",
    createElement(CustomersScreen, {
      customers: [
        { id: "c-1", kind: "retail", displayName: "Adwoa Mensah", phoneMasked: "024 *** 0182" },
        {
          id: "c-2",
          kind: "b2b",
          displayName: "Accra Buildworks Ltd",
          company: "Accra Buildworks Ltd",
          phoneMasked: "020 *** 4410",
        },
        {
          id: "c-3",
          kind: "b2b",
          displayName: "Tema Trade Supplies Ltd",
          company: "Tema Trade Supplies Ltd",
          phoneMasked: "055 *** 2705",
        },
        {
          id: "c-4",
          kind: "b2b",
          displayName: "Northstar Projects Ltd",
          company: "Northstar Projects Ltd",
          phoneMasked: "027 *** 6021",
        },
      ],
      commercialContextById: { "c-2": "Group A", "c-3": "Group B", "c-4": "Negotiated" },
      onUseCustomer: () => undefined,
    }),
    { shiftOpen: false },
  );
}

export function buildUx04ReturnsHtml(): string {
  return wrap(
    "returns",
    createElement(ReturnsScreen, {
      session: idleReturnSession(),
      inFlight: false,
      lookup: {
        async search() {
          return [];
        },
      },
      matches: [
        {
          saleId: "sale-24091",
          orderReference: "#24091",
          currency: "GHS",
          customerLabel: "Accra Buildworks Ltd",
          createdAt: "2026-09-10T15:12:00.000Z",
          total: { minor: 115000, currency: "GHS" },
          itemSummary: "2 × Premium Interior Emulsion Paint 20L",
          lines: [{ orderLineId: "ol-1", name: "Premium Interior Emulsion Paint 20L", originalSoldQuantity: "2" }],
        },
        {
          saleId: "sale-24088",
          orderReference: "#24088",
          currency: "GHS",
          customerLabel: "Adwoa Mensah",
          createdAt: "2026-09-10T12:08:00.000Z",
          total: { minor: 42500, currency: "GHS" },
          itemSummary: "1 × 650W Professional Impact Drill",
          lines: [{ orderLineId: "ol-2", name: "650W Professional Impact Drill", originalSoldQuantity: "1" }],
        },
      ],
      onSelectSale: () => undefined,
      onUpdateLine: () => undefined,
      onPreview: () => undefined,
      onExecute: () => undefined,
      onResolve: () => undefined,
    }),
    { shiftOpen: false },
  );
}

export function buildUx04RegisterOpenedToastHtml(): string {
  const sell = buildSellOpenShiftHarnessHtml();
  const toastCss = css("apps/pos-web/src/ui/toast/toast.css");
  const toast = renderToStaticMarkup(createElement(AppToast, { title: "Register opened.", open: true }));
  return sell.replace("</style>", `${toastCss}</style>`).replace("</main>", `${toast}</main>`);
}
