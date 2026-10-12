import { describe, expect, test } from "vitest";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createMemoryStaffAccessControl } from "../auth/staff-access-control";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { handlePaystackPresentation } from "./handle-paystack-presentation";
import { allowlistedPaystackUrl, paystackTestCheckoutUrl } from "./paystack-presentation";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const TEST_ENV = {
  PAYMENT_PROVIDER: "paystack",
  PAYSTACK_MODE: "test",
  PAYSTACK_SECRET_KEY: "sk_test_presentation_example",
  PAYSTACK_CARD_ENABLED: "false",
};
const assignments = createMemoryAssignmentDirectory([
  {
    actorId: "cashier_a",
    organizationId: "org_a",
    locationRoles: [{ locationId: "loc_a", role: "cashier" }],
    registerIds: ["reg_a"],
  },
]);
const accessControl = createMemoryStaffAccessControl();
const TX = "11111111-1111-4111-8111-111111111111";
const PAYMENT = "15151515-1515-4515-8515-151515151515";

async function cookie(organizationId = "org_a", locationIds: readonly string[] = ["loc_a"]) {
  const sessions = createEphemeralInMemoryStaffSessionStore();
  const session: Session = {
    actorId: "cashier_a",
    displayName: "Ada",
    organizationId,
    locationIds: [...locationIds],
    capabilities: [],
    expiresAt: "2026-10-10T18:00:00.000Z",
  };
  const id = await sessions.create(session, "csrf", new Date("2026-10-10T18:00:00.000Z"));
  return { sessions, cookieHeader: `cetech_pos_sid=${id}` };
}

describe("Paystack test presentation", () => {
  test("returns one allowlisted test URL for the stored payment and drops anything else", async () => {
    expect(allowlistedPaystackUrl("http://checkout.paystack.com/abc")).toBeUndefined();
    expect(allowlistedPaystackUrl("https://evil.example/abc")).toBeUndefined();
    expect(paystackTestCheckoutUrl({ accessCode: "ACCESSCODE", authorizationUrl: "https://evil.example/x" })).toBe(
      "https://checkout.paystack.com/ACCESSCODE",
    );
    const store = createInMemoryCheckoutStore();
    await store.seedPreparedSale({
      organizationId: "org_a",
      locationId: "loc_a",
      locationName: "Store",
      registerId: "reg_a",
      registerName: "Register A",
      deviceId: "44444444-4444-4444-8444-444444444444",
      shiftId: "66666666-6666-4666-8666-666666666666",
      cashierId: "cashier_a",
      cashierName: "Ada",
      customer: { kind: "walkin" },
      customerLabel: "Walk-in",
      prepared: {
        transactionId: TX,
        saleId: "sale-1",
        orderReference: "1001",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
        total: { minor: 2900, currency: "GHS" },
        status: "prepared",
        stockCommitment: "reserved",
        preparedAt: NOW.toISOString(),
        expiresAt: "2026-10-10T13:00:00.000Z",
      },
      subtotal: { minor: 2900, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
      lines: [],
    });
    await store.savePayment({
      paymentId: PAYMENT,
      transactionId: TX,
      saleId: "sale-1",
      tender: "card",
      status: "awaiting_customer",
      amount: { minor: 2900, currency: "GHS" },
      actorId: "cashier_a",
      provider: "paystack",
      providerReference: "ref-1",
      accessCode: "ACCESSCODE",
      authorizationUrl: "https://checkout.paystack.com/ACCESSCODE",
      displayReference: "ref-1",
    });
    const prepared = await store.getSale(TX);
    if (prepared) {
      await store.saveSale({ ...prepared, status: "payment_pending", assignedPaymentId: PAYMENT });
    }
    const auth = await cookie();
    const first = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments,
      accessControl,
      env: TEST_ENV,
    });
    const second = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments,
      accessControl,
      env: TEST_ENV,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.data.url).toBe(second.data.url);
    expect(JSON.stringify(first)).not.toContain("sk_");
    expect(first.data.url).toBe("https://checkout.paystack.com/ACCESSCODE");
    expect(first.data.mode).toBe("test");

    const other = await cookie("org_b");
    const denied = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac",
      cookieHeader: other.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: other.sessions,
      checkoutStore: store,
      assignments,
      accessControl,
      env: TEST_ENV,
    });
    expect(denied.ok).toBe(false);

    const live = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments,
      accessControl,
      env: { ...TEST_ENV, PAYSTACK_MODE: "live" },
    });
    expect(live.ok).toBe(false);

    const unknownMode = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments,
      accessControl,
      env: { ...TEST_ENV, PAYSTACK_MODE: "sandbox" },
    });
    expect(unknownMode.ok).toBe(false);

    const liveKey = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaf",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments,
      accessControl,
      env: { ...TEST_ENV, PAYSTACK_SECRET_KEY: "sk_live_not_for_pos" },
    });
    expect(liveKey.ok).toBe(false);

    const disabled = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments,
      accessControl: createMemoryStaffAccessControl({ "org_a:cashier_a": "disabled" }),
      env: TEST_ENV,
    });
    expect(disabled.ok).toBe(false);
  });

  test("refuses a password change, a removed assignment, the wrong register, and a finished sale", async () => {
    const store = createInMemoryCheckoutStore();
    await store.seedPreparedSale({
      organizationId: "org_a",
      locationId: "loc_a",
      locationName: "Store",
      registerId: "reg_a",
      registerName: "Register A",
      deviceId: "44444444-4444-4444-8444-444444444444",
      shiftId: "66666666-6666-4666-8666-666666666666",
      cashierId: "cashier_a",
      cashierName: "Ada",
      customer: { kind: "walkin" },
      customerLabel: "Walk-in",
      prepared: {
        transactionId: TX,
        saleId: "sale-1",
        orderReference: "1001",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
        total: { minor: 2900, currency: "GHS" },
        status: "prepared",
        stockCommitment: "reserved",
        preparedAt: NOW.toISOString(),
        expiresAt: "2026-10-10T13:00:00.000Z",
      },
      subtotal: { minor: 2900, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
      lines: [],
    });
    await store.savePayment({
      paymentId: PAYMENT,
      transactionId: TX,
      saleId: "sale-1",
      tender: "card",
      status: "pending",
      amount: { minor: 2900, currency: "GHS" },
      actorId: "cashier_a",
      provider: "paystack",
      providerReference: "ref-1",
      accessCode: "ACCESSCODE",
      authorizationUrl: "https://checkout.paystack.com/ACCESSCODE",
      displayReference: "ref-1",
    });
    const prepared = await store.getSale(TX);
    if (prepared) await store.saveSale({ ...prepared, status: "payment_pending", assignedPaymentId: PAYMENT });
    const auth = await cookie();
    const pending = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments,
      accessControl,
      env: TEST_ENV,
    });
    expect(pending.ok).toBe(true);
    if (pending.ok) expect(pending.data.url).toBe("https://checkout.paystack.com/ACCESSCODE");

    const otherTx = "22222222-2222-4222-8222-222222222222";
    const otherPayment = "25252525-2525-4525-8525-252525252525";
    await store.seedPreparedSale({
      organizationId: "org_a",
      locationId: "loc_a",
      locationName: "Store",
      registerId: "reg_a",
      registerName: "Register A",
      deviceId: "44444444-4444-4444-8444-444444444444",
      shiftId: "66666666-6666-4666-8666-666666666666",
      cashierId: "cashier_a",
      cashierName: "Ada",
      customer: { kind: "walkin" },
      customerLabel: "Walk-in",
      prepared: {
        transactionId: otherTx,
        saleId: "sale-2",
        orderReference: "1002",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
        total: { minor: 2900, currency: "GHS" },
        status: "prepared",
        stockCommitment: "reserved",
        preparedAt: NOW.toISOString(),
        expiresAt: "2026-10-10T13:00:00.000Z",
      },
      subtotal: { minor: 2900, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
      lines: [],
    });
    await store.savePayment({
      paymentId: otherPayment,
      transactionId: otherTx,
      saleId: "sale-2",
      tender: "card",
      status: "awaiting_customer",
      amount: { minor: 2900, currency: "GHS" },
      actorId: "cashier_a",
      provider: "paystack",
      providerReference: "ref-2",
      accessCode: "OTHERCODE",
      authorizationUrl: "https://checkout.paystack.com/OTHERCODE",
      displayReference: "ref-2",
    });
    const otherPrepared = await store.getSale(otherTx);
    if (otherPrepared) {
      await store.saveSale({ ...otherPrepared, status: "payment_pending", assignedPaymentId: otherPayment });
    }
    const otherLink = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
      cookieHeader: auth.cookieHeader,
      paymentId: otherPayment,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments,
      accessControl,
      env: TEST_ENV,
    });
    expect(otherLink.ok).toBe(true);
    if (otherLink.ok) {
      expect(otherLink.data.url).toBe("https://checkout.paystack.com/OTHERCODE");
      expect(otherLink.data.url).not.toBe("https://checkout.paystack.com/ACCESSCODE");
    }

    const password = createEphemeralInMemoryStaffSessionStore();
    const passwordSession: Session = {
      actorId: "cashier_a",
      displayName: "Ada",
      organizationId: "org_a",
      locationIds: ["loc_a"],
      capabilities: [],
      expiresAt: "2026-10-10T18:00:00.000Z",
    };
    const passwordId = await password.create(passwordSession, "csrf", new Date("2026-10-10T18:00:00.000Z"), {
      mustChangePassword: true,
    });
    const changed = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
      cookieHeader: `cetech_pos_sid=${passwordId}`,
      paymentId: PAYMENT,
      now: NOW,
      sessions: password,
      checkoutStore: store,
      assignments,
      accessControl,
      env: TEST_ENV,
    });
    expect(changed.ok).toBe(false);

    const removed = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments: createMemoryAssignmentDirectory([]),
      accessControl,
      env: TEST_ENV,
    });
    expect(removed.ok).toBe(false);

    const wrongRegister = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "cashier_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a", role: "cashier" }],
          registerIds: ["reg_other"],
        },
      ]),
      accessControl,
      env: TEST_ENV,
    });
    expect(wrongRegister.ok).toBe(false);

    const finishedSale = await store.getSale(TX);
    if (finishedSale) await store.saveSale({ ...finishedSale, status: "completed" });
    const finished = await handlePaystackPresentation({
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6",
      cookieHeader: auth.cookieHeader,
      paymentId: PAYMENT,
      now: NOW,
      sessions: auth.sessions,
      checkoutStore: store,
      assignments,
      accessControl,
      env: TEST_ENV,
    });
    expect(finished.ok).toBe(false);
  });
});
