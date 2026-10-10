import { createElement, useMemo } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReceiptSnapshot } from "../../../docs/contracts/domain.generated";
import type { CustomerPort } from "../../../docs/contracts/ports";
import type { StaffRuntimeAuthority } from "../src/core/identity";
import { checkoutScopeFromStaffAuthority } from "../src/core/identity";
import { ApprovedWorkspaceScreens } from "../src/app/workspace-runtime";
import { workspaceReceiptPrintPorts } from "../src/app/history-receipt-ports";
import type { CashCheckoutPorts } from "../src/features/sell";

const TX = "33326bbc-1dd7-4582-8409-ea434942d8db";
const RECEIPT_ID = "rcpt-33326bbc";
const RECEIPT_NUMBER = "POS-50317";

const SNAPSHOT: ReceiptSnapshot = {
  id: RECEIPT_ID,
  transactionId: TX,
  receiptNumber: RECEIPT_NUMBER,
  orderReference: "50317",
  issuedAt: "2026-10-08T12:00:00.000Z",
  locationName: "Accra Main Store",
  registerName: "Front Counter",
  cashierName: "Ama",
  customerLabel: "Walk-in",
  lines: [
    {
      name: "XL INGCO Nitrile Frosted Coated Gloves",
      quantity: "1",
      unitPrice: { minor: 2900, currency: "GHS" },
      subtotal: { minor: 2900, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
      total: { minor: 2900, currency: "GHS" },
    },
  ],
  subtotal: { minor: 2900, currency: "GHS" },
  discount: { minor: 0, currency: "GHS" },
  tax: { minor: 0, currency: "GHS" },
  total: { minor: 2900, currency: "GHS" },
  tender: "cash",
  documentKind: "operational_pos_receipt",
};

const orderItem = {
  id: TX,
  orderReference: "#50317",
  receiptNumber: RECEIPT_NUMBER,
  customerLabel: "Walk-in",
  createdAt: "2026-10-08T12:00:00.000Z",
  paymentLabel: "Cash",
  paymentStatus: "verified" as const,
  total: { minor: 2900, currency: "GHS" },
  status: "completed" as const,
  transactionReference: TX,
  cashierLabel: "Ama",
  registerLabel: "Front Counter",
  lines: [
    {
      id: "line-1",
      name: "XL INGCO Nitrile Frosted Coated Gloves",
      quantity: "1",
      total: { minor: 2900, currency: "GHS" },
    },
  ],
};

type Mode = "corrected" | "baseline-checkout-only";

type AuthorityKind = "no-register" | "register-no-shift" | "presentation-only" | "signed-out";

declare global {
  interface Window {
    __reprintHarness?: {
      mount: (input: { mode: Mode; authority: AuthorityKind }) => void;
      unmount: () => void;
      calls: string[];
      commercial: string[];
      scope: unknown;
    };
  }
}

function authorityFor(kind: AuthorityKind): StaffRuntimeAuthority {
  const base: StaffRuntimeAuthority = {
    status: "ready",
    session: {
      actorId: "cashier_a",
      displayName: "Cashier A",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
      capabilities: ["pos.sell"],
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
    assignedLocationIds: ["loc_a1"],
    assignedRegisterIds: ["reg_a"],
    assignedRegisters: [
      {
        id: "reg_a",
        name: "Front Counter",
        locationId: "loc_a1",
        currency: "GHS",
        status: "active",
      },
    ],
    selectedRegisterId: null,
    register: null,
    shift: null,
    shiftOpen: false,
  };
  if (kind === "signed-out") {
    return {
      ...base,
      status: "signed_out",
      session: null,
    };
  }
  if (kind === "presentation-only") {
    return { ...base, presentationOnly: true };
  }
  if (kind === "register-no-shift") {
    return {
      ...base,
      selectedRegisterId: "reg_a",
      register: base.assignedRegisters[0]!,
      shift: null,
      shiftOpen: false,
    };
  }
  return base;
}

/** Prior PosRuntime wiring: receipts/printer only from cash checkout ports. */
function baselineCheckoutOnlyPorts(checkout: CashCheckoutPorts | null) {
  return {
    receipts: checkout?.receipts,
    printer: checkout?.printer,
  };
}

function commercialMutation(url: string): boolean {
  return (
    /\/api\/pos\/v1\/sales\/prepare\b/.test(url) ||
    /\/api\/pos\/v1\/sales\/finalize\b/.test(url) ||
    /\/api\/pos\/v1\/sales\/cancel\b/.test(url) ||
    /\/api\/pos\/v1\/payments\b/.test(url) ||
    /\/api\/pos\/v1\/returns\b/.test(url) ||
    /refund|tender|stock/i.test(url)
  );
}

function HarnessApp({
  mode,
  authorityKind,
  calls,
  commercial,
}: {
  readonly mode: Mode;
  readonly authorityKind: AuthorityKind;
  readonly calls: string[];
  readonly commercial: string[];
}) {
  const authority = useMemo(() => authorityFor(authorityKind), [authorityKind]);
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url}`);
    if (commercialMutation(url)) commercial.push(`${method} ${url}`);
    if (url.includes("/api/pos/v1/orders?") || url.endsWith("/api/pos/v1/orders")) {
      return new Response(JSON.stringify({ ok: true, correlationId: "corr-list", data: { items: [orderItem] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes(`/api/pos/v1/orders/${TX}`)) {
      return new Response(JSON.stringify({ ok: true, correlationId: "corr-detail", data: orderItem }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes(`/api/pos/v1/receipts/${TX}`)) {
      return new Response(JSON.stringify({ ok: true, correlationId: "corr-receipt", data: SNAPSHOT }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: false, error: { code: "NOT_FOUND", message: "unexpected" } }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  };

  const checkout = null;
  const printPorts =
    mode === "corrected"
      ? workspaceReceiptPrintPorts({
          presentationOnly: !!authority.presentationOnly || authority.status !== "ready" || !authority.session,
          checkout,
          fetchImpl,
        })
      : baselineCheckoutOnlyPorts(checkout);

  const customers: CustomerPort = {
    async search() {
      return { ok: true, data: [], correlationId: "corr-cust" };
    },
  };

  return createElement(ApprovedWorkspaceScreens, {
    route: "orders",
    authority,
    customers,
    online: true,
    catalogAvailability: "fresh",
    fetchImpl,
    appearance: "system",
    attentionItems: [],
    attentionCount: 0,
    attentionState: "ready",
    onNavigate: () => undefined,
    onUseCustomer: () => undefined,
    onAppearanceChange: () => undefined,
    onRebuildSuccess: () => undefined,
    onRetryAttention: () => undefined,
    receipts: printPorts.receipts,
    printer: printPorts.printer,
  });
}

let root: Root | null = null;
const calls: string[] = [];
const commercial: string[] = [];

window.__reprintHarness = {
  calls,
  commercial,
  scope: null,
  mount({ mode, authority }) {
    calls.length = 0;
    commercial.length = 0;
    const host = document.getElementById("root");
    if (!host) throw new Error("missing #root");
    if (root) {
      root.unmount();
      root = null;
    }
    const auth = authorityFor(authority);
    window.__reprintHarness!.scope = checkoutScopeFromStaffAuthority(auth) ?? null;
    root = createRoot(host);
    root.render(createElement(HarnessApp, { mode, authorityKind: authority, calls, commercial }));
  },
  unmount() {
    root?.unmount();
    root = null;
  },
};
