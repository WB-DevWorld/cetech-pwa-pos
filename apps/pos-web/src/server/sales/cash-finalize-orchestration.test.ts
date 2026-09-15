import { describe, expect, test } from "vitest";
import type { CustomerContext, Money, PreparedSale, ReceiptLine } from "../../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import type { CheckoutStore } from "../../core/checkout/types";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createCheckoutRuntime } from "./compose-checkout-runtime";
import { handleConfirmCash } from "./handle-confirm-cash";
import { handleFinalizeSale } from "./handle-finalize-sale";
import { handleGetReceipt } from "./handle-get-receipt";
import { handleOpenShift } from "./handle-open-shift";
import { createMockSalesPort } from "./mock-sales-port";

const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORIGIN = "https://pos.example.test";
const CSRF = "csrf-core05-token";
const NOW = new Date("2026-09-14T14:00:00.000Z");
const DEVICE_ID = "44444444-4444-4444-8444-444444444444";
const TX_A = "11111111-1111-4111-8111-111111111111";
const TX_B = "11111111-1111-4111-8111-111111111112";
const CASH_KEY = "22222222-2222-4222-8222-222222222222";
const CASH_KEY_2 = "22222222-2222-4222-8222-222222222223";
const CASH_KEY_SHORT = "22222222-2222-4222-8222-222222222224";
const CASH_KEY_CURRENCY = "22222222-2222-4222-8222-222222222225";
const CASH_KEY_SCOPE = "22222222-2222-4222-8222-222222222226";
const FINALIZE_KEY = "33333333-3333-4333-8333-333333333333";
const OPEN_KEY = "55555555-5555-4555-8555-555555555555";
const OPEN_KEY_2 = "55555555-5555-4555-8555-555555555556";
const FINGERPRINT = "0123456789abcdef0123456789abcdef";

function cashierAssignments(registerIds: readonly string[] = ["reg_a1"]) {
  return createMemoryAssignmentDirectory([
    {
      actorId: "cashier_a",
      organizationId: "org_a",
      locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
      registerIds,
    },
  ]);
}

function ghs(minor: number): Money {
  return { minor, currency: "GHS" };
}

function line(total: Money, name = "Hardener"): ReceiptLine {
  return {
    name,
    quantity: "1",
    unitPrice: total,
    subtotal: total,
    discount: ghs(0),
    tax: ghs(0),
    total,
  };
}

function prepared(transactionId: string, total: Money, saleId: string): PreparedSale {
  return {
    transactionId,
    saleId,
    orderReference: saleId,
    quoteFingerprint: FINGERPRINT,
    total,
    status: "prepared",
    stockCommitment: "reserved",
    preparedAt: "2026-09-14T13:00:00.000Z",
    expiresAt: "2026-09-14T18:00:00.000Z",
  };
}

async function staffCookies(locationIds: readonly string[] = ["loc_a1"]) {
  const store = createEphemeralInMemoryStaffSessionStore();
  const sessionId = await store.create(
    {
      actorId: "cashier_a",
      displayName: "Cashier A",
      organizationId: "org_a",
      locationIds: [...locationIds],
      capabilities: ["ui.hint.only"],
      expiresAt: "2026-09-14T22:00:00.000Z",
    },
    CSRF,
    new Date("2026-09-14T22:00:00.000Z"),
  );
  return {
    store,
    cookieHeader: `${STAFF_SESSION_COOKIE}=${sessionId}; ${STAFF_CSRF_COOKIE}=${CSRF}`,
  };
}

async function seedRegister(store: CheckoutStore) {
  await store.seedRegister({
    id: "reg_a1",
    name: "Register 1",
    locationId: "loc_a1",
    currency: "GHS",
    status: "active",
    organizationId: "org_a",
  });
  await store.seedDevice({
    id: DEVICE_ID,
    organizationId: "org_a",
    locationId: "loc_a1",
    status: "active",
  });
}

async function seedSale(
  store: CheckoutStore,
  input: {
    transactionId: string;
    saleId: string;
    total: Money;
    customer: CustomerContext;
    shiftId: string;
    customerLabel: string;
  },
) {
  await store.seedPreparedSale({
    organizationId: "org_a",
    locationId: "loc_a1",
    locationName: "Accra Store",
    registerId: "reg_a1",
    registerName: "Register 1",
    deviceId: DEVICE_ID,
    shiftId: input.shiftId,
    cashierId: "cashier_a",
    cashierName: "Cashier A",
    customer: input.customer,
    customerLabel: input.customerLabel,
    prepared: prepared(input.transactionId, input.total, input.saleId),
    lines: [line(input.total)],
    subtotal: input.total,
    discount: ghs(0),
    tax: ghs(0),
  });
}

async function openRegister(checkoutStore: CheckoutStore) {
  const { store, cookieHeader } = await staffCookies();
  const opened = await handleOpenShift({
    correlationIdHeader: CORRELATION,
    origin: ORIGIN,
    referer: null,
    csrfHeader: CSRF,
    cookieHeader,
    idempotencyKeyHeader: OPEN_KEY,
    body: { registerId: "reg_a1", deviceId: DEVICE_ID, openingFloat: ghs(10000) },
    now: NOW,
    sessionStore: store,
    allowedOrigins: [ORIGIN],
    checkoutStore,
    assignments: cashierAssignments(),
  });
  expect(opened.body.ok).toBe(true);
  if (!opened.body.ok) {
    throw new Error("expected open shift");
  }
  return { sessionStore: store, cookieHeader, shift: opened.body.data };
}

describe("CORE-05 cash + FinalizeSale orchestration", () => {
  test("same cash command yields one net ledger effect and replays the same payment", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    await seedRegister(checkoutStore);
    const opened = await openRegister(checkoutStore);
    await seedSale(checkoutStore, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: opened.shift.id,
      customerLabel: "Walk-in",
    });
    const cashBody = { transactionId: TX_A, cashReceived: ghs(2000) };
    const first = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: cashBody,
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    const replay = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: cashBody,
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(first.body.ok && replay.body.ok).toBe(true);
    if (first.body.ok && replay.body.ok) {
      expect(first.body.data.paymentId).toBe(replay.body.data.paymentId);
      expect(first.body.data.status).toBe("verified");
      expect(first.body.data.amount).toEqual(ghs(1500));
    }
    const movements = await checkoutStore.listCashSales(TX_A);
    expect(movements).toHaveLength(1);
    expect(movements[0]?.signedAmount).toEqual({ minor: 1500, currency: "GHS" });
    const expected = await checkoutStore.expectedCash(opened.shift.id);
    expect(expected).toEqual(ghs(11500));
  });

  test("same Idempotency-Key with a different cash body is IDEMPOTENCY_CONFLICT and does not add a second movement", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    await seedRegister(checkoutStore);
    const opened = await openRegister(checkoutStore);
    await seedSale(checkoutStore, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: opened.shift.id,
      customerLabel: "Walk-in",
    });
    await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    const conflict = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2500) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.ok).toBe(false);
    if (!conflict.body.ok) {
      expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    }
    expect(await checkoutStore.listCashSales(TX_A)).toHaveLength(1);
  });

  test("insufficient cash then a corrected amount on the same key is one tender and one receipt", async () => {
    const runtime = createCheckoutRuntime();
    await seedRegister(runtime.store);
    const opened = await openRegister(runtime.store);
    await seedSale(runtime.store, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: opened.shift.id,
      customerLabel: "Walk-in",
    });
    const short = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(500) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
    });
    expect(short.body.ok).toBe(false);
    if (!short.body.ok) {
      expect(short.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await runtime.store.listCashSales(TX_A)).toHaveLength(0);
    expect(await runtime.store.getPaymentForTransaction(TX_A)).toBeUndefined();
    expect(await runtime.store.peekIdempotency("org_a", "payment.cash", CASH_KEY)).toBeUndefined();

    const corrected = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
    });
    expect(corrected.body.ok).toBe(true);
    if (!corrected.body.ok) {
      throw new Error("expected corrected cash");
    }
    const finalized = await handleFinalizeSale({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_A, paymentId: corrected.body.data.paymentId },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
      salesPort: runtime.salesPort,
    });
    expect(finalized.body.ok).toBe(true);
    if (finalized.body.ok) {
      expect(finalized.body.data.status).toBe("completed");
    }
    expect(await runtime.store.listCashSales(TX_A)).toHaveLength(1);
    expect(await runtime.store.getReceipt(TX_A)).toBeTruthy();
    expect(runtime.salesPort.commercialSaleCount).toBe(1);
  });

  test("amount, currency, customer, and scope mismatches are rejected without a ledger write", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    await seedRegister(checkoutStore);
    const opened = await openRegister(checkoutStore);
    await seedSale(checkoutStore, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "b2b", customerId: "cust-a" },
      shiftId: opened.shift.id,
      customerLabel: "cust-a",
    });
    await seedSale(checkoutStore, {
      transactionId: TX_B,
      saleId: "woo-1002",
      total: ghs(1500),
      customer: { kind: "b2b", customerId: "cust-b" },
      shiftId: opened.shift.id,
      customerLabel: "cust-b",
    });

    const short = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY_SHORT,
      body: { transactionId: TX_A, cashReceived: ghs(500) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(short.body.ok).toBe(false);
    if (!short.body.ok) {
      expect(short.body.error.code).toBe("VALIDATION_ERROR");
    }

    const currency = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY_CURRENCY,
      body: { transactionId: TX_A, cashReceived: { minor: 2000, currency: "USD" } },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(currency.body.ok).toBe(false);
    if (!currency.body.ok) {
      expect(currency.body.error.code).toBe("VALIDATION_ERROR");
    }

    const otherLocation = await staffCookies(["loc_other"]);
    const scope = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: otherLocation.cookieHeader,
      idempotencyKeyHeader: CASH_KEY_SCOPE,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: otherLocation.store,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(scope.status).toBe(403);
    expect(scope.body.ok).toBe(false);
    if (!scope.body.ok) {
      expect(scope.body.error.code).toBe("FORBIDDEN");
    }

    const cashA = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(cashA.body.ok).toBe(true);
    if (!cashA.body.ok) {
      throw new Error("expected cash A");
    }
    const customerMismatch = await handleFinalizeSale({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_B, paymentId: cashA.body.data.paymentId },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
      salesPort: createMockSalesPort(),
    });
    expect(customerMismatch.body.ok).toBe(false);
    if (!customerMismatch.body.ok) {
      expect(customerMismatch.body.error.code).toBe("PAYMENT_NOT_VERIFIED");
    }
    expect(await checkoutStore.listCashSales(TX_A)).toHaveLength(1);
    expect(await checkoutStore.listCashSales(TX_B)).toHaveLength(0);
  });

  test("overlapping cash commands for one transaction still produce one cash_sale", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    await seedRegister(checkoutStore);
    const opened = await openRegister(checkoutStore);
    await seedSale(checkoutStore, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: opened.shift.id,
      customerLabel: "Walk-in",
    });
    const body = { transactionId: TX_A, cashReceived: ghs(2000) };
    const [left, right] = await Promise.all([
      handleConfirmCash({
        correlationIdHeader: CORRELATION,
        origin: ORIGIN,
        referer: null,
        csrfHeader: CSRF,
        cookieHeader: opened.cookieHeader,
        idempotencyKeyHeader: CASH_KEY,
        body,
        now: NOW,
        sessionStore: opened.sessionStore,
        allowedOrigins: [ORIGIN],
        checkoutStore,
        assignments: cashierAssignments(),
      }),
      handleConfirmCash({
        correlationIdHeader: CORRELATION,
        origin: ORIGIN,
        referer: null,
        csrfHeader: CSRF,
        cookieHeader: opened.cookieHeader,
        idempotencyKeyHeader: CASH_KEY_2,
        body,
        now: NOW,
        sessionStore: opened.sessionStore,
        allowedOrigins: [ORIGIN],
        checkoutStore,
        assignments: cashierAssignments(),
      }),
    ]);
    expect(left.body.ok && right.body.ok).toBe(true);
    if (left.body.ok && right.body.ok) {
      expect(left.body.data.paymentId).toBe(right.body.data.paymentId);
    }
    expect(await checkoutStore.listCashSales(TX_A)).toHaveLength(1);
    expect(await checkoutStore.expectedCash(opened.shift.id)).toEqual(ghs(11500));
  });

  test("Woo success then POS receipt failure is repairable without a second commercial sale", async () => {
    const runtime = createCheckoutRuntime();
    await seedRegister(runtime.store);
    const opened = await openRegister(runtime.store);
    await seedSale(runtime.store, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: opened.shift.id,
      customerLabel: "Walk-in",
    });
    const cash = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
    });
    expect(cash.body.ok).toBe(true);
    if (!cash.body.ok) {
      throw new Error("expected cash");
    }
    runtime.store.failNextReceiptWrite = true;
    const firstFinalize = await handleFinalizeSale({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_A, paymentId: cash.body.data.paymentId },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
      salesPort: runtime.salesPort,
    });
    expect(firstFinalize.status).toBe(200);
    expect(firstFinalize.body.ok).toBe(true);
    if (firstFinalize.body.ok) {
      expect(firstFinalize.body.data.status).toBe("requires_attention");
      expect(firstFinalize.body.data.receiptId).toBeUndefined();
    }
    expect(runtime.salesPort.commercialSaleCount).toBe(1);
    expect(runtime.store.receiptWriteAttempts).toBe(1);
    expect(await runtime.store.getReceipt(TX_A)).toBeUndefined();
    expect(await runtime.store.listOutbox(TX_A)).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: "sale.receipt_persist_repair" })]),
    );

    const repaired = await handleFinalizeSale({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_A, paymentId: cash.body.data.paymentId },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
      salesPort: runtime.salesPort,
    });
    expect(repaired.body.ok).toBe(true);
    if (repaired.body.ok) {
      expect(repaired.body.data.status).toBe("completed");
      expect(repaired.body.data.receiptId).toBeTruthy();
    }
    expect(runtime.salesPort.commercialSaleCount).toBe(1);
    expect(await runtime.store.listCashSales(TX_A)).toHaveLength(1);

    const receipt = await handleGetReceipt({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      cookieHeader: opened.cookieHeader,
      transactionId: TX_A,
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
    });
    expect(receipt.status).toBe(200);
    expect(receipt.body.ok).toBe(true);
    if (receipt.body.ok) {
      expect(receipt.body.data.documentKind).toBe("operational_pos_receipt");
      expect(receipt.body.data.cashReceived).toEqual(ghs(2000));
      expect(receipt.body.data.changeDue).toEqual(ghs(500));
    }
  });

  test("valid cash then finalize completes with a unique receipt and finalize replay is idempotent", async () => {
    const runtime = createCheckoutRuntime();
    await seedRegister(runtime.store);
    const opened = await openRegister(runtime.store);
    await seedSale(runtime.store, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: opened.shift.id,
      customerLabel: "Walk-in",
    });
    const cash = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(1500) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
    });
    expect(cash.body.ok).toBe(true);
    if (!cash.body.ok) {
      throw new Error("expected cash");
    }
    const finalizeBody = { transactionId: TX_A, paymentId: cash.body.data.paymentId };
    const first = await handleFinalizeSale({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: finalizeBody,
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
      salesPort: runtime.salesPort,
    });
    const replay = await handleFinalizeSale({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: finalizeBody,
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
      salesPort: runtime.salesPort,
    });
    expect(first.body.ok && replay.body.ok).toBe(true);
    if (first.body.ok && replay.body.ok) {
      expect(first.body.data.status).toBe("completed");
      expect(replay.body.data.status).toBe("completed");
      expect(first.body.data.receiptId).toBe(replay.body.data.receiptId);
    }
    expect(runtime.salesPort.commercialSaleCount).toBe(1);
    expect(runtime.store.receiptWriteAttempts).toBe(1);
  });

  test("second open shift on the same register is SHIFT_CONFLICT; cash without a shift is SHIFT_REQUIRED", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    await seedRegister(checkoutStore);
    const opened = await openRegister(checkoutStore);
    const second = await handleOpenShift({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: OPEN_KEY_2,
      body: { registerId: "reg_a1", deviceId: DEVICE_ID, openingFloat: ghs(5000) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(second.body.ok).toBe(false);
    if (!second.body.ok) {
      expect(second.body.error.code).toBe("SHIFT_CONFLICT");
    }

    const noShiftStore = createInMemoryCheckoutStore();
    await seedRegister(noShiftStore);
    await seedSale(noShiftStore, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: "66666666-6666-4666-8666-666666666666",
      customerLabel: "Walk-in",
    });
    const { store, cookieHeader } = await staffCookies();
    const cash = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      checkoutStore: noShiftStore,
      assignments: cashierAssignments(),
    });
    expect(cash.body.ok).toBe(false);
    if (!cash.body.ok) {
      expect(cash.body.error.code).toBe("SHIFT_REQUIRED");
    }
    expect(await noShiftStore.listCashSales(TX_A)).toHaveLength(0);
  });

  test("anonymous cash is AUTH_REQUIRED and extra cash fields fail schema validation", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    const anonymous = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: `${STAFF_CSRF_COOKIE}=${CSRF}`,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: createEphemeralInMemoryStaffSessionStore(),
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(anonymous.status).toBe(401);
    const { store, cookieHeader } = await staffCookies();
    const extra = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000), customerId: "spoof" },
      now: NOW,
      sessionStore: store,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(extra.status).toBe(400);
    expect(extra.body.ok).toBe(false);
    if (!extra.body.ok) {
      expect(extra.body.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("CORE-02 assignment directory, not session capabilities, authorizes cash", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    await seedRegister(checkoutStore);
    const opened = await openRegister(checkoutStore);
    await seedSale(checkoutStore, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: opened.shift.id,
      customerLabel: "Walk-in",
    });
    const cashBody = { transactionId: TX_A, cashReceived: ghs(2000) };

    const noLocation = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: cashBody,
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "cashier_a",
          organizationId: "org_a",
          locationRoles: [],
          registerIds: ["reg_a1"],
        },
      ]),
    });
    expect(noLocation.status).toBe(403);
    if (!noLocation.body.ok) {
      expect(noLocation.body.error.code).toBe("FORBIDDEN");
    }

    const noRegister = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: cashBody,
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "cashier_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
          registerIds: ["reg_other"],
        },
      ]),
    });
    expect(noRegister.status).toBe(403);
    if (!noRegister.body.ok) {
      expect(noRegister.body.error.code).toBe("FORBIDDEN");
    }

    const badCsrf = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: "wrong-csrf",
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: cashBody,
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(badCsrf.status).toBe(403);
    if (!badCsrf.body.ok) {
      expect(badCsrf.body.error.code).toBe("FORBIDDEN");
    }

    const badOrigin = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: "https://evil.example",
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: cashBody,
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(badOrigin.status).toBe(403);
    if (!badOrigin.body.ok) {
      expect(badOrigin.body.error.code).toBe("FORBIDDEN");
    }
    expect(await checkoutStore.listCashSales(TX_A)).toHaveLength(0);
  });

  test("cash ledger then POS payment persist failure repairs without a second movement", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    await seedRegister(checkoutStore);
    const opened = await openRegister(checkoutStore);
    await seedSale(checkoutStore, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: opened.shift.id,
      customerLabel: "Walk-in",
    });
    checkoutStore.failNextPaymentWrite = true;
    const first = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(first.body.ok).toBe(true);
    if (first.body.ok) {
      expect(first.body.data.status).toBe("requires_attention");
    }
    expect(await checkoutStore.listCashSales(TX_A)).toHaveLength(1);
    expect(await checkoutStore.peekIdempotency("org_a", "payment.cash", CASH_KEY)).toBe("requires_attention");

    const repaired = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore,
      assignments: cashierAssignments(),
    });
    expect(repaired.body.ok).toBe(true);
    if (repaired.body.ok) {
      expect(repaired.body.data.status).toBe("verified");
    }
    expect(await checkoutStore.listCashSales(TX_A)).toHaveLength(1);
    expect(await checkoutStore.peekIdempotency("org_a", "payment.cash", CASH_KEY)).toBe("acknowledged");
    expect(await checkoutStore.expectedCash(opened.shift.id)).toEqual(ghs(11500));
  });

  test("commercial success then POS sale persist failure repairs without a second sale", async () => {
    const runtime = createCheckoutRuntime();
    await seedRegister(runtime.store);
    const opened = await openRegister(runtime.store);
    await seedSale(runtime.store, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: opened.shift.id,
      customerLabel: "Walk-in",
    });
    const cash = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
    });
    expect(cash.body.ok).toBe(true);
    if (!cash.body.ok) {
      throw new Error("expected cash");
    }
    runtime.store.failNextCommercialConfirmedWrite = true;
    const first = await handleFinalizeSale({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_A, paymentId: cash.body.data.paymentId },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
      salesPort: runtime.salesPort,
    });
    expect(first.body.ok).toBe(true);
    if (first.body.ok) {
      expect(first.body.data.status).toBe("requires_attention");
    }
    expect(runtime.salesPort.commercialSaleCount).toBe(1);
    expect(await runtime.store.peekIdempotency("org_a", "sale.finalize", FINALIZE_KEY)).toBe("requires_attention");
    const stored = await runtime.store.getSale(TX_A);
    expect(stored?.commercialConfirmed).toBe(false);

    const repaired = await handleFinalizeSale({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_A, paymentId: cash.body.data.paymentId },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
      salesPort: runtime.salesPort,
    });
    expect(repaired.body.ok).toBe(true);
    if (repaired.body.ok) {
      expect(repaired.body.data.status).toBe("completed");
    }
    expect(runtime.salesPort.commercialSaleCount).toBe(1);
    expect(await runtime.store.peekIdempotency("org_a", "sale.finalize", FINALIZE_KEY)).toBe("acknowledged");
  });

  test("ok requires_attention from the commercial bridge does not complete a POS receipt", async () => {
    const runtime = createCheckoutRuntime();
    await seedRegister(runtime.store);
    const opened = await openRegister(runtime.store);
    await seedSale(runtime.store, {
      transactionId: TX_A,
      saleId: "woo-1001",
      total: ghs(1500),
      customer: { kind: "walkin" },
      shiftId: opened.shift.id,
      customerLabel: "Walk-in",
    });
    const cash = await handleConfirmCash({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
    });
    expect(cash.body.ok).toBe(true);
    if (!cash.body.ok) {
      throw new Error("expected cash");
    }
    let confirmCalls = 0;
    const first = await handleFinalizeSale({
      correlationIdHeader: CORRELATION,
      origin: ORIGIN,
      referer: null,
      csrfHeader: CSRF,
      cookieHeader: opened.cookieHeader,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_A, paymentId: cash.body.data.paymentId },
      now: NOW,
      sessionStore: opened.sessionStore,
      allowedOrigins: [ORIGIN],
      checkoutStore: runtime.store,
      assignments: cashierAssignments(),
      salesPort: {
        async confirmPayment(input, context) {
          confirmCalls += 1;
          return {
            ok: true,
            data: {
              transactionId: input.transactionId,
              status: "requires_attention",
              saleId: input.payment.saleId,
              paymentId: input.payment.paymentId,
              message: "Woo requires attention",
            },
            correlationId: context.correlationId,
          };
        },
      },
    });
    expect(first.body.ok).toBe(true);
    if (first.body.ok) {
      expect(first.body.data.status).toBe("requires_attention");
    }
    const stored = await runtime.store.getSale(TX_A);
    expect(stored?.commercialConfirmed).toBe(false);
    expect(stored?.status).not.toBe("completed");
    expect(await runtime.store.getReceipt(TX_A)).toBeUndefined();
    expect(confirmCalls).toBe(1);
    expect(runtime.salesPort.commercialSaleCount).toBe(0);
  });
});
