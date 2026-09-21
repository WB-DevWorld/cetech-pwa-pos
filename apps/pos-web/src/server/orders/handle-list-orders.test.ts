import { describe, expect, test } from "vitest";
import type { Money, PreparedSale, ReceiptLine, ReceiptSnapshot } from "../../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { handleListOrders } from "./handle-list-orders";
import { handleGetOrder } from "./handle-get-order";

const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORIGIN = "https://pos.example.test";
const CSRF = "csrf-ux04-orders";
const NOW = new Date("2026-09-19T12:00:00.000Z");
const TX = "11111111-1111-4111-8111-111111111091";
const PAYMENT = "22222222-2222-4222-8222-222222222091";
const DEVICE = "44444444-4444-4444-8444-444444444444";
const SHIFT = "55555555-5555-4555-8555-555555555091";

function ghs(minor: number): Money {
  return { minor, currency: "GHS" };
}

function line(): ReceiptLine {
  return {
    name: "Premium Interior Emulsion Paint 20L",
    quantity: "2",
    unitPrice: ghs(57500),
    subtotal: ghs(115000),
    discount: ghs(0),
    tax: ghs(0),
    total: ghs(115000),
  };
}

function prepared(): PreparedSale {
  return {
    transactionId: TX,
    saleId: "sale-24091",
    orderReference: "#24091",
    quoteFingerprint: "0123456789abcdef0123456789abcdef",
    total: ghs(115000),
    status: "prepared",
    stockCommitment: "reserved",
    preparedAt: "2026-09-10T15:12:00.000Z",
    expiresAt: "2026-09-10T18:12:00.000Z",
  };
}

function receipt(): ReceiptSnapshot {
  return {
    id: "rcpt-24091",
    transactionId: TX,
    receiptNumber: "CT-00091",
    orderReference: "#24091",
    issuedAt: "2026-09-10T15:12:00.000Z",
    locationName: "Main store",
    registerName: "Front Counter",
    cashierName: "Cashier A",
    customerLabel: "Accra Buildworks Ltd",
    lines: [line()],
    subtotal: ghs(115000),
    discount: ghs(0),
    tax: ghs(0),
    total: ghs(115000),
    tender: "mobile_money",
    documentKind: "operational_pos_receipt",
  };
}

async function staffCookies() {
  const store = createEphemeralInMemoryStaffSessionStore();
  const sessionId = await store.create(
    {
      actorId: "cashier_a",
      displayName: "Cashier A",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
      capabilities: ["ui.hint.only"],
      expiresAt: "2026-09-19T22:00:00.000Z",
    },
    CSRF,
    new Date("2026-09-19T22:00:00.000Z"),
  );
  return {
    store,
    cookieHeader: `${STAFF_SESSION_COOKIE}=${sessionId}; ${STAFF_CSRF_COOKIE}=${CSRF}`,
  };
}

function assignments() {
  return createMemoryAssignmentDirectory([
    {
      actorId: "cashier_a",
      organizationId: "org_a",
      locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
      registerIds: ["reg_a1"],
    },
  ]);
}

describe("UX-04 order history read model", () => {
  test("lists completed sales with separate payment and order status", async () => {
    const checkout = createInMemoryCheckoutStore();
    const seeded = await checkout.seedPreparedSale({
      organizationId: "org_a",
      locationId: "loc_a1",
      locationName: "Main store",
      registerId: "reg_a1",
      registerName: "Front Counter",
      deviceId: DEVICE,
      shiftId: SHIFT,
      cashierId: "cashier_a",
      cashierName: "Cashier A",
      customer: { kind: "b2b", customerId: "cust-buildworks" },
      customerLabel: "Accra Buildworks Ltd",
      customerSnapshot: {
        id: "cust-buildworks",
        kind: "b2b",
        displayName: "Accra Buildworks Ltd",
        company: "BuildWorks Ghana Ltd",
      },
      prepared: prepared(),
      lines: [line()],
      orderLines: [{ orderLineId: "ol-1", quantity: "2", subtotal: ghs(115000), discount: ghs(0), tax: ghs(0), total: ghs(115000) }],
      subtotal: ghs(115000),
      discount: ghs(0),
      tax: ghs(0),
    });
    await checkout.saveSale({ ...seeded, status: "completed", commercialConfirmed: true, receipt: receipt() });
    const { store, cookieHeader } = await staffCookies();
    const listed = await handleListOrders({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: ORIGIN,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      checkoutStore: checkout,
      assignments: assignments(),
      query: "",
    });
    expect(listed.status).toBe(200);
    expect(listed.body.ok).toBe(true);
    if (!listed.body.ok) return;
    expect(listed.body.data.items).toHaveLength(1);
    const item = listed.body.data.items[0];
    expect(item?.orderReference).toBe("#24091");
    expect(item?.saleId).toBe("sale-24091");
    expect(item?.paymentLabel).toBe("Mobile Money");
    expect(item?.paymentStatus).toBe("verified");
    expect(item?.status).toBe("completed");
    expect(item?.customerKind).toBe("b2b");
    expect(item?.customerLabel).toBe("Accra Buildworks Ltd");
    expect(item?.customerId).toBe("cust-buildworks");
    expect(item?.customerCompany).toBe("BuildWorks Ghana Ltd");

    const searched = await handleListOrders({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: ORIGIN,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      checkoutStore: checkout,
      assignments: assignments(),
      query: "Ghana Ltd",
    });
    expect(searched.body.ok).toBe(true);
    if (searched.body.ok) expect(searched.body.data.items).toHaveLength(1);

    const missed = await handleListOrders({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: ORIGIN,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      checkoutStore: checkout,
      assignments: assignments(),
      query: "no-such-order",
    });
    expect(missed.body.ok).toBe(true);
    if (missed.body.ok) expect(missed.body.data.items).toHaveLength(0);

    const detail = await handleGetOrder({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: ORIGIN,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      checkoutStore: checkout,
      assignments: assignments(),
      transactionId: TX,
    });
    expect(detail.status).toBe(200);
    expect(detail.body.ok).toBe(true);
    if (detail.body.ok) {
      expect(detail.body.data.saleId).toBe("sale-24091");
      expect(detail.body.data.lines[0]?.name).toContain("Emulsion");
    }
  });

  test("presents legacy opaque customer ids with a neutral fallback and separate canonical id", async () => {
    const checkout = createInMemoryCheckoutStore();
    const seeded = await checkout.seedPreparedSale({
      organizationId: "org_a",
      locationId: "loc_a1",
      locationName: "Main store",
      registerId: "reg_a1",
      registerName: "Front Counter",
      deviceId: DEVICE,
      shiftId: SHIFT,
      cashierId: "cashier_a",
      cashierName: "Cashier A",
      customer: { kind: "b2b", customerId: "cust-legacy" },
      customerLabel: "cust-legacy",
      prepared: prepared(),
      lines: [line()],
      subtotal: ghs(115000),
      discount: ghs(0),
      tax: ghs(0),
    });
    await checkout.saveSale({ ...seeded, status: "completed", commercialConfirmed: true });

    const { store, cookieHeader } = await staffCookies();
    const listed = await handleListOrders({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: ORIGIN,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      checkoutStore: checkout,
      assignments: assignments(),
      query: "",
    });
    expect(listed.body.ok).toBe(true);
    if (!listed.body.ok) return;
    const item = listed.body.data.items[0];
    expect(item?.customerLabel).toBe("Saved customer account");
    expect(item?.customerId).toBe("cust-legacy");
    expect(item?.customerCompany).toBeUndefined();

    const detail = await handleGetOrder({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: ORIGIN,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      checkoutStore: checkout,
      assignments: assignments(),
      transactionId: TX,
    });
    expect(detail.body.ok).toBe(true);
    if (detail.body.ok) {
      expect(detail.body.data.customerLabel).toBe("Saved customer account");
      expect(detail.body.data.customerId).toBe("cust-legacy");
    }
  });

  test("keeps uncertain electronic payment status pending without collapsing order state", async () => {
    const checkout = createInMemoryCheckoutStore();
    const seeded = await checkout.seedPreparedSale({
      organizationId: "org_a",
      locationId: "loc_a1",
      locationName: "Main store",
      registerId: "reg_a1",
      registerName: "Front Counter",
      deviceId: DEVICE,
      shiftId: SHIFT,
      cashierId: "cashier_a",
      cashierName: "Cashier A",
      customer: { kind: "walkin" },
      customerLabel: "Walk-in",
      prepared: { ...prepared(), saleId: "sale-pending", orderReference: "#24000" },
      lines: [line()],
      subtotal: ghs(115000),
      discount: ghs(0),
      tax: ghs(0),
    });
    await checkout.saveSale({ ...seeded, status: "payment_pending" });
    await checkout.savePayment({
      paymentId: PAYMENT,
      transactionId: TX,
      saleId: "sale-pending",
      tender: "mobile_money",
      status: "pending",
      amount: ghs(115000),
      actorId: "cashier_a",
      displayReference: "TX-PENDING-1",
    });
    const { store, cookieHeader } = await staffCookies();
    const listed = await handleListOrders({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: ORIGIN,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      checkoutStore: checkout,
      assignments: assignments(),
      query: "",
    });
    expect(listed.body.ok).toBe(true);
    if (!listed.body.ok) return;
    const item = listed.body.data.items[0];
    expect(item?.paymentStatus).toBe("pending");
    expect(item?.status).toBe("payment_pending");
    expect(item?.paymentLabel).toBe("Mobile Money");
  });
});
