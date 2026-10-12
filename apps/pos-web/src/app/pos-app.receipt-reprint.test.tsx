import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ReceiptSnapshot } from "../../../../docs/contracts/domain.generated";
import { checkoutScopeFromStaffAuthority, type StaffRuntimeAuthority } from "../core/identity";
import { mapReceiptSnapshot } from "../features/sell/runtime/cashCheckoutController";
import { OrderDetailDialog, type OrderDetailView } from "../features/orders";
import { reprintImmutableReceipt } from "../features/orders/reprint-receipt";
import { workspaceReceiptPrintPorts } from "./history-receipt-ports";

afterEach(() => {
  vi.unstubAllGlobals();
});

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
      name: "Test SKU",
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

const orderDetail: OrderDetailView = {
  id: TX,
  orderReference: "#50317",
  receiptNumber: RECEIPT_NUMBER,
  customerLabel: "Walk-in",
  createdAt: "2026-10-08T12:00:00.000Z",
  paymentLabel: "Cash",
  paymentStatus: "verified",
  total: { minor: 2900, currency: "GHS" },
  status: "completed",
  transactionReference: TX,
  cashierLabel: "Ama",
  registerLabel: "Front Counter",
  lines: [{ id: "line-1", name: "Test SKU", quantity: "1", total: { minor: 2900, currency: "GHS" } }],
};

/** Assigned signed-in staff with a location but no selected register / open shift. */
function assignedStaffNoCheckoutScope(): StaffRuntimeAuthority {
  return {
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
}

function commercialMutationPath(url: string): boolean {
  return (
    /\/api\/pos\/v1\/sales\/prepare\b/.test(url) ||
    /\/api\/pos\/v1\/sales\/finalize\b/.test(url) ||
    /\/api\/pos\/v1\/sales\/cancel\b/.test(url) ||
    /\/api\/pos\/v1\/payments\b/.test(url) ||
    /\/api\/pos\/v1\/returns\b/.test(url) ||
    /refund|tender|stock/i.test(url)
  );
}

/** Same mount→print DOM contract the Orders workspace and PrintPort expect. */
function stubMountedPrintEnvironment(receiptId: string) {
  const style = { dataset: {} as Record<string, string>, textContent: "", remove: vi.fn() };
  const paper = {
    dataset: { receiptId, receiptSource: "receipt-port" },
    isConnected: true,
    scrollHeight: 150,
    textContent: `Receipt ${RECEIPT_NUMBER} Accra Main Store`,
    getBoundingClientRect: () => ({ height: 150 }),
    querySelectorAll: () => [],
  };
  const media = Object.assign(new EventTarget(), { matches: false });
  const view = Object.assign(new EventTarget(), {
    matchMedia: () => media,
    navigator: { userAgent: "Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36" },
  }) as EventTarget & {
    print: ReturnType<typeof vi.fn>;
    matchMedia: () => EventTarget & { matches: boolean };
    navigator: { userAgent: string };
  };
  const print = vi.fn(() => {
    view.dispatchEvent(new Event("afterprint"));
  });
  view.print = print;
  const documentStub = {
    cookie: "",
    querySelector: (selector: string) => {
      if (selector.includes("receipt-paper") || selector.includes("receipt-port")) return paper;
      return null;
    },
    createElement: () => style,
    head: { append: vi.fn() },
    fonts: { ready: Promise.resolve() },
    defaultView: view,
  };
  vi.stubGlobal("window", view);
  vi.stubGlobal("document", documentStub);
  return { print, paper, style, documentStub };
}

describe("pos-app history receipt reprint composition", () => {
  test("pos-app wires workspaceReceiptPrintPorts instead of checkout-only receipts/printer", () => {
    const source = readFileSync(new URL("./pos-app.tsx", import.meta.url), "utf8");
    expect(source).toContain('from "./history-receipt-ports"');
    expect(source).toContain("workspaceReceiptPrintPorts");
    expect(source).toContain("receipts: historyPrint.receipts");
    expect(source).toContain("printer: historyPrint.printer");
    expect(source).not.toMatch(/receipts:\s*checkout\?\.receipts,\s*\r?\n\s*printer:\s*checkout\?\.printer/);
  });

  test.each([
    {
      label: "no selected register / no open shift",
      authority: assignedStaffNoCheckoutScope(),
    },
    {
      label: "selected register without open shift",
      authority: {
        ...assignedStaffNoCheckoutScope(),
        selectedRegisterId: "reg_a",
        register: {
          id: "reg_a",
          name: "Front Counter",
          locationId: "loc_a1",
          currency: "GHS" as const,
          status: "active" as const,
        },
        shift: null,
        shiftOpen: false,
      },
    },
  ])("baseline hides Reprint; correction offers it ($label)", ({ authority }) => {
    expect(checkoutScopeFromStaffAuthority(authority)).toBeUndefined();

    const baseline = { receipts: undefined as undefined, printer: undefined as undefined };
    const corrected = workspaceReceiptPrintPorts({
      presentationOnly: false,
      checkout: null,
    });

    const baselineHtml = renderToStaticMarkup(
      createElement(OrderDetailDialog, {
        open: true,
        order: orderDetail,
        onClose: () => undefined,
        onReprint: baseline.receipts && baseline.printer ? () => undefined : undefined,
      }),
    );
    expect(baselineHtml).not.toContain("Reprint");

    const correctedHtml = renderToStaticMarkup(
      createElement(OrderDetailDialog, {
        open: true,
        order: orderDetail,
        onClose: () => undefined,
        onReprint: corrected.receipts && corrected.printer ? () => undefined : undefined,
      }),
    );
    expect(correctedHtml).toContain("Reprint");
    expect(corrected.receipts).toBeDefined();
    expect(corrected.printer).toBeDefined();
  });

  test("assigned staff without register/shift reprints stored receipt after mount with zero commercial mutations", async () => {
    const authority = assignedStaffNoCheckoutScope();
    expect(checkoutScopeFromStaffAuthority(authority)).toBeUndefined();

    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push(`${init?.method ?? "GET"} ${url}`);
      if (url.includes(`/api/pos/v1/receipts/${TX}`)) {
        return new Response(
          JSON.stringify({ ok: true, correlationId: "corr-reprint", data: SNAPSHOT }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ ok: false, error: { code: "NOT_FOUND", message: "unexpected" } }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    };

    const ports = workspaceReceiptPrintPorts({
      presentationOnly: false,
      checkout: null,
      fetchImpl,
    });
    expect(ports.receipts && ports.printer).toBeTruthy();

    const env = stubMountedPrintEnvironment(RECEIPT_ID);
    const sequence: string[] = [];

    const runOnce = async () =>
      reprintImmutableReceipt({
        transactionId: TX,
        receipts: ports.receipts!,
        mapReceipt: mapReceiptSnapshot,
        present: (view) => {
          sequence.push(`mount:${view.receiptNumber}`);
          // Synchronous mount gate used by OrdersWorkspace (flushSync + receiptPaperIsMounted).
          expect(view.id).toBe(RECEIPT_ID);
          expect(env.paper.dataset.receiptId).toBe(view.id);
          expect((env.paper.textContent ?? "").includes(view.receiptNumber)).toBe(true);
          return true;
        },
        print: async (receiptId) => {
          sequence.push(`print:${receiptId}`);
          expect(sequence[0]).toBe(`mount:${RECEIPT_NUMBER}`);
          return ports.printer!.print({ receiptId, reason: "reprint" });
        },
      });

    const first = await runOnce();
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.snapshot.id).toBe(RECEIPT_ID);
      expect(first.printed.status).toBe("dialog_opened");
    }
    expect(sequence).toEqual([`mount:${RECEIPT_NUMBER}`, `print:${RECEIPT_ID}`]);
    expect(calls).toEqual([`GET /api/pos/v1/receipts/${TX}`]);
    expect(calls.some((call) => commercialMutationPath(call))).toBe(false);
    expect(env.print).toHaveBeenCalledOnce();
    expect(env.style.remove).toHaveBeenCalledOnce();

    sequence.length = 0;
    const second = await runOnce();
    expect(second.ok).toBe(true);
    expect(sequence).toEqual([`mount:${RECEIPT_NUMBER}`, `print:${RECEIPT_ID}`]);
    expect(calls).toEqual([`GET /api/pos/v1/receipts/${TX}`, `GET /api/pos/v1/receipts/${TX}`]);
    expect(calls.some((call) => commercialMutationPath(call))).toBe(false);
    expect(env.print).toHaveBeenCalledTimes(2);
  });

  test("cancelled present path does not print and cleans up without commercial requests", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(
        JSON.stringify({ ok: true, correlationId: "corr-cancel", data: SNAPSHOT }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const ports = workspaceReceiptPrintPorts({
      presentationOnly: false,
      checkout: null,
      fetchImpl,
    });
    const print = vi.fn(async () => ({ status: "dialog_opened" as const, message: "should not run" }));
    const outcome = await reprintImmutableReceipt({
      transactionId: TX,
      receipts: ports.receipts!,
      mapReceipt: mapReceiptSnapshot,
      present: () => false,
      print,
    });
    expect(outcome.ok).toBe(false);
    expect(print).not.toHaveBeenCalled();
    expect(calls).toEqual([`GET /api/pos/v1/receipts/${TX}`]);
    expect(calls.some((call) => commercialMutationPath(call))).toBe(false);
  });

  test("offline presentation-only staff does not obtain history receipt/print ports; checkout stays blocked", () => {
    const offline: StaffRuntimeAuthority = {
      ...assignedStaffNoCheckoutScope(),
      presentationOnly: true,
    };
    expect(checkoutScopeFromStaffAuthority(offline)).toBeUndefined();
    const ports = workspaceReceiptPrintPorts({
      presentationOnly: true,
      checkout: null,
    });
    expect(ports.receipts).toBeUndefined();
    expect(ports.printer).toBeUndefined();

    const html = renderToStaticMarkup(
      createElement(OrderDetailDialog, {
        open: true,
        order: orderDetail,
        onClose: () => undefined,
        onReprint: ports.receipts && ports.printer ? () => undefined : undefined,
      }),
    );
    expect(html).not.toContain("Reprint");
  });

  test("checkout use-cases remain absent without scope while history reprint ports exist", () => {
    const authority = assignedStaffNoCheckoutScope();
    expect(checkoutScopeFromStaffAuthority(authority)).toBeUndefined();
    const checkout = null;
    const ports = workspaceReceiptPrintPorts({
      presentationOnly: false,
      checkout,
    });
    expect(checkout).toBeNull();
    expect(ports.receipts).toBeDefined();
    expect(ports.printer).toBeDefined();
  });
});
