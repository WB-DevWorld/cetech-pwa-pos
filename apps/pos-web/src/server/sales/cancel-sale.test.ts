import { describe, expect, test } from "vitest";
import type { CustomerContext, Money, PreparedSale, ReceiptLine } from "../../../../../docs/contracts/domain.generated";
import type { SalesPort } from "../../../../../docs/contracts/ports";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import type { CheckoutStore } from "../../core/checkout/types";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { handleCancelSale } from "./handle-cancel-sale";
import { handleOpenShift } from "./handle-open-shift";

const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORIGIN = "https://pos.example.test";
const CSRF = "csrf-ux03-cancel";
const NOW = new Date("2026-09-19T14:00:00.000Z");
const DEVICE_ID = "44444444-4444-4444-8444-444444444444";
const TX = "11111111-1111-4111-8111-111111111111";
const CANCEL_KEY = "22222222-2222-4222-8222-222222222222";
const OPEN_KEY = "55555555-5555-4555-8555-555555555555";

function cashierAssignments() {
  return createMemoryAssignmentDirectory([
    {
      actorId: "cashier_a",
      organizationId: "org_a",
      locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
      registerIds: ["reg_a1"],
    },
  ]);
}

function ghs(minor: number): Money {
  return { minor, currency: "GHS" };
}

function line(total: Money): ReceiptLine {
  return {
    name: "Hardener",
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
    quoteFingerprint: "0123456789abcdef0123456789abcdef",
    total,
    status: "prepared",
    stockCommitment: "reserved",
    preparedAt: "2026-09-19T13:00:00.000Z",
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

async function seedPrepared(store: CheckoutStore, shiftId: string) {
  await store.seedPreparedSale({
    organizationId: "org_a",
    locationId: "loc_a1",
    locationName: "Accra Store",
    registerId: "reg_a1",
    registerName: "Register 1",
    deviceId: DEVICE_ID,
    shiftId,
    cashierId: "cashier_a",
    cashierName: "Cashier A",
    customer: { kind: "walkin" } satisfies CustomerContext,
    customerLabel: "Walk-in",
    prepared: prepared(TX, ghs(1500), "woo-1001"),
    lines: [line(ghs(1500))],
    subtotal: ghs(1500),
    discount: ghs(0),
    tax: ghs(0),
  });
}

function env(
  opened: Awaited<ReturnType<typeof openRegister>>,
  checkoutStore: CheckoutStore,
  salesPort: Pick<SalesPort, "cancel" | "resolve">,
) {
  return {
    correlationIdHeader: CORRELATION,
    origin: ORIGIN,
    referer: null as string | null,
    csrfHeader: CSRF,
    cookieHeader: opened.cookieHeader,
    now: NOW,
    sessionStore: opened.sessionStore,
    allowedOrigins: [ORIGIN],
    checkoutStore,
    salesPort,
    assignments: cashierAssignments(),
  };
}

describe("UX-03 BFF cancel prepared sale", () => {
  test("cancels an outstanding prepared sale once and replays the same idempotency key", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    await seedRegister(checkoutStore);
    const opened = await openRegister(checkoutStore);
    await seedPrepared(checkoutStore, opened.shift.id);
    let cancelCount = 0;
    const salesPort = {
      async cancel(input: { transactionId: string }, context: { correlationId: string }) {
        cancelCount += 1;
        return {
          ok: true as const,
          correlationId: context.correlationId,
          data: {
            transactionId: input.transactionId,
            status: "cancelled" as const,
            saleId: "woo-1001",
            orderReference: "woo-1001",
          },
        };
      },
      async resolve(transactionId: string) {
        return {
          ok: true as const,
          correlationId: CORRELATION,
          data: { transactionId, status: "cancelled" as const, saleId: "woo-1001", orderReference: "woo-1001" },
        };
      },
    } satisfies Pick<SalesPort, "cancel" | "resolve">;
    const first = await handleCancelSale({
      ...env(opened, checkoutStore, salesPort),
      idempotencyKeyHeader: CANCEL_KEY,
      body: { transactionId: TX, reason: "cashier_cancelled_prepared_sale" },
    });
    const replay = await handleCancelSale({
      ...env(opened, checkoutStore, salesPort),
      idempotencyKeyHeader: CANCEL_KEY,
      body: { transactionId: TX, reason: "cashier_cancelled_prepared_sale" },
    });
    expect(first.body.ok).toBe(true);
    expect(replay.body.ok).toBe(true);
    expect(cancelCount).toBe(1);
    if (first.body.ok && replay.body.ok) {
      expect(first.body.data.status).toBe("cancelled");
      expect(replay.body.data.status).toBe("cancelled");
    }
    const stored = await checkoutStore.getSale(TX);
    expect(stored?.status).toBe("cancelled");
  });

  test("refuses cancel after a verified payment without creating another commercial sale", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    await seedRegister(checkoutStore);
    const opened = await openRegister(checkoutStore);
    await seedPrepared(checkoutStore, opened.shift.id);
    await checkoutStore.savePayment({
      paymentId: "22222222-2222-4222-8222-222222222222",
      transactionId: TX,
      saleId: "woo-1001",
      tender: "cash",
      status: "verified",
      amount: ghs(1500),
      actorId: "cashier_a",
      verifiedAt: "2026-09-19T14:00:00.000Z",
      verificationSource: "cash_ledger",
    });
    let cancelCount = 0;
    const salesPort = {
      async cancel() {
        cancelCount += 1;
        throw new Error("bridge cancel must not run");
      },
      async resolve(transactionId: string) {
        return {
          ok: true as const,
          correlationId: CORRELATION,
          data: { transactionId, status: "payment_pending" as const },
        };
      },
    } satisfies Pick<SalesPort, "cancel" | "resolve">;
    const result = await handleCancelSale({
      ...env(opened, checkoutStore, salesPort),
      idempotencyKeyHeader: CANCEL_KEY,
      body: { transactionId: TX },
    });
    expect(result.body.ok).toBe(false);
    expect(cancelCount).toBe(0);
  });

  test("unknown cancel result resolves the same transaction", async () => {
    const checkoutStore = createInMemoryCheckoutStore();
    await seedRegister(checkoutStore);
    const opened = await openRegister(checkoutStore);
    await seedPrepared(checkoutStore, opened.shift.id);
    let cancelCount = 0;
    const salesPort = {
      async cancel() {
        cancelCount += 1;
        throw new Error("lost cancel response");
      },
      async resolve(transactionId: string) {
        return {
          ok: true as const,
          correlationId: CORRELATION,
          data: {
            transactionId,
            status: "cancelled" as const,
            saleId: "woo-1001",
            orderReference: "woo-1001",
          },
        };
      },
    } satisfies Pick<SalesPort, "cancel" | "resolve">;
    const result = await handleCancelSale({
      ...env(opened, checkoutStore, salesPort),
      idempotencyKeyHeader: CANCEL_KEY,
      body: { transactionId: TX, reason: "cashier_cancelled_prepared_sale" },
    });
    expect(cancelCount).toBe(1);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.data.status).toBe("cancelled");
      expect(result.body.data.transactionId).toBe(TX);
    }
  });
});
