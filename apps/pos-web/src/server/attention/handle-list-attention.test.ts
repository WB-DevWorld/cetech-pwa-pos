import { describe, expect, test } from "vitest";
import type { Money, PreparedSale } from "../../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { composeAttentionItems } from "./attention-view";
import { handleListAttention } from "./handle-list-attention";

const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORIGIN = "https://pos.example.test";
const CSRF = "csrf-ux04-attention";
const NOW = new Date("2026-09-19T12:00:00.000Z");
const TX = "11111111-1111-4111-8111-111111111077";
const PAYMENT = "22222222-2222-4222-8222-222222222077";
const DEVICE = "44444444-4444-4444-8444-444444444444";
const SHIFT = "55555555-5555-4555-8555-555555555077";

function ghs(minor: number): Money {
  return { minor, currency: "GHS" };
}

function prepared(): PreparedSale {
  return {
    transactionId: TX,
    saleId: "sale-attn",
    orderReference: "#attn",
    quoteFingerprint: "0123456789abcdef0123456789abcdef",
    total: ghs(1000),
    status: "prepared",
    stockCommitment: "reserved",
    preparedAt: "2026-09-19T11:00:00.000Z",
    expiresAt: "2026-09-19T18:00:00.000Z",
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

describe("UX-04 attention read model", () => {
  test("maps a durable uncertain payment to the same payment identity", async () => {
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
      prepared: prepared(),
      lines: [
        {
          name: "Cable",
          quantity: "1",
          unitPrice: ghs(1000),
          subtotal: ghs(1000),
          discount: ghs(0),
          tax: ghs(0),
          total: ghs(1000),
        },
      ],
      subtotal: ghs(1000),
      discount: ghs(0),
      tax: ghs(0),
    });
    await checkout.saveSale({ ...seeded, status: "payment_pending" });
    await checkout.savePayment({
      paymentId: PAYMENT,
      transactionId: TX,
      saleId: "sale-attn",
      tender: "mobile_money",
      status: "requires_attention",
      amount: ghs(1000),
      actorId: "cashier_a",
      displayReference: "TX-PENDING-1",
    });
    const { store, cookieHeader } = await staffCookies();
    const result = await handleListAttention({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: ORIGIN,
      cookieHeader,
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      checkoutStore: checkout,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "cashier_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
          registerIds: ["reg_a1"],
        },
      ]),
    });
    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) return;
    expect(result.body.data.count).toBe(1);
    const item = result.body.data.items[0];
    expect(item?.id).toBe(`payment:${PAYMENT}`);
    expect(item?.transactionId).toBe(TX);
    expect(item?.paymentId).toBe(PAYMENT);
    expect(item?.transactionReference).toBe("TX-PENDING-1");
    expect(item?.reviewAllowed).toBe(false);
    expect(item?.resolveAllowed).toBe(true);
    expect(item?.recoverKind).toBe("payment");
    expect(item?.summary).toContain("Do not charge the customer again");
  });

  test("does not treat reviewed as resolved", () => {
    const items = composeAttentionItems({
      payments: [
        {
          paymentId: PAYMENT,
          transactionId: TX,
          saleId: "sale-attn",
          tender: "mobile_money",
          status: "pending",
          amount: ghs(1000),
          actorId: "cashier_a",
        },
      ],
      sales: [],
      shifts: [],
      operations: [],
    });
    expect(items[0]?.reviewAllowed).toBe(false);
    expect(items[0]?.resolveAllowed).toBe(true);
    expect(items[0]?.transactionId).toBe(TX);
    expect(items[0]?.paymentId).toBe(PAYMENT);
  });

  test("verified payments leave the durable queue", () => {
    const items = composeAttentionItems({
      payments: [
        {
          paymentId: PAYMENT,
          transactionId: TX,
          saleId: "sale-attn",
          tender: "mobile_money",
          status: "verified",
          amount: ghs(1000),
          actorId: "cashier_a",
        },
      ],
      sales: [],
      shifts: [],
      operations: [],
    });
    expect(items).toEqual([]);
  });

  test("sale attention carries the same transaction identity", () => {
    const items = composeAttentionItems({
      payments: [],
      sales: [
        {
          organizationId: "org_a",
          locationId: "loc_a1",
          locationName: "Main",
          registerId: "reg_a1",
          registerName: "Front",
          deviceId: DEVICE,
          shiftId: SHIFT,
          cashierId: "cashier_a",
          cashierName: "Cashier A",
          customer: { kind: "walkin" },
          customerLabel: "Walk-in",
          prepared: prepared(),
          lines: [],
          subtotal: ghs(1000),
          discount: ghs(0),
          tax: ghs(0),
          status: "requires_attention",
          commercialConfirmed: false,
        },
      ],
      shifts: [],
      operations: [],
    });
    expect(items[0]?.recoverKind).toBe("sale");
    expect(items[0]?.transactionId).toBe(TX);
    expect(items[0]?.resolveAllowed).toBe(true);
  });

  test("payment operations recover as payments and refund operations do not recover as sales", () => {
    const paymentOp = composeAttentionItems({
      payments: [],
      sales: [],
      shifts: [],
      operations: [
        {
          organizationId: "org_a",
          locationId: "loc_a1",
          registerId: "reg_a1",
          transactionId: TX,
          operation: "payment.initialize",
        },
      ],
    });
    expect(paymentOp[0]?.recoverKind).toBe("payment");
    expect(paymentOp[0]?.resolveAllowed).toBe(true);
    expect(paymentOp[0]?.transactionId).toBe(TX);

    const refundOp = composeAttentionItems({
      payments: [],
      sales: [],
      shifts: [],
      operations: [
        {
          organizationId: "org_a",
          locationId: "loc_a1",
          registerId: "reg_a1",
          transactionId: TX,
          operation: "payment.refund",
        },
      ],
    });
    expect(refundOp[0]?.recoverKind).toBe("return");
    expect(refundOp[0]?.resolveAllowed).toBe(false);

    const stockOp = composeAttentionItems({
      payments: [],
      sales: [],
      shifts: [],
      operations: [
        {
          organizationId: "org_a",
          locationId: "loc_a1",
          transactionId: TX,
          operation: "bridge.stock_disposition",
        },
      ],
    });
    expect(stockOp[0]?.recoverKind).toBe("return");
    expect(stockOp[0]?.resolveAllowed).toBe(false);
  });
});
