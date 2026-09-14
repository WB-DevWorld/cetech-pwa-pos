import { describe, expect, test } from "vitest";
import type {
  CashPaymentRequest,
  CommandContext,
  Money,
  PreparedSale,
  ReceiptLine,
} from "../../../../../docs/contracts/domain.generated";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import type { CheckoutStore, StaffActor } from "../../core/checkout/types";
import { confirmCash } from "./confirm-cash";

const CORRELATION: CommandContext["correlationId"] = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const CASH_KEY_A: CommandContext["idempotencyKey"] = "22222222-2222-4222-8222-222222222222";
const CASH_KEY_B: CommandContext["idempotencyKey"] = "22222222-2222-4222-8222-222222222223";
const TX: CashPaymentRequest["transactionId"] = "11111111-1111-4111-8111-111111111111";
const SHIFT_ID = "66666666-6666-4666-8666-666666666666";
const DEVICE_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-09-14T16:30:00.000Z");

const ACTOR: StaffActor = {
  actorId: "cashier_a",
  displayName: "Cashier A",
  organizationId: "org_a",
  locationIds: ["loc_a1"],
};

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

function prepared(total: Money): PreparedSale {
  return {
    transactionId: TX,
    saleId: "woo-1001",
    orderReference: "woo-1001",
    quoteFingerprint: "0123456789abcdef0123456789abcdef",
    total,
    status: "prepared",
    stockCommitment: "reserved",
    preparedAt: "2026-09-14T13:00:00.000Z",
    expiresAt: "2026-09-14T18:00:00.000Z",
  };
}

function context(idempotencyKey: CommandContext["idempotencyKey"]): CommandContext {
  return { idempotencyKey, correlationId: CORRELATION };
}

async function setupPaidSale() {
  const store = createInMemoryCheckoutStore();
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
  expect(
    await store.insertOpenShift({
      id: SHIFT_ID,
      registerId: "reg_a1",
      deviceId: DEVICE_ID,
      cashierId: ACTOR.actorId,
      status: "open",
      openingFloat: ghs(10000),
      expectedCash: ghs(10000),
      openedAt: "2026-09-14T13:30:00.000Z",
      organizationId: "org_a",
      locationId: "loc_a1",
    }),
  ).toBe("ok");

  const total = ghs(1500);
  await store.seedPreparedSale({
    organizationId: "org_a",
    locationId: "loc_a1",
    locationName: "Accra Store",
    registerId: "reg_a1",
    registerName: "Register 1",
    deviceId: DEVICE_ID,
    shiftId: SHIFT_ID,
    cashierId: ACTOR.actorId,
    cashierName: ACTOR.displayName,
    customer: { kind: "walkin" },
    customerLabel: "Walk-in",
    prepared: prepared(total),
    lines: [line(total)],
    subtotal: total,
    discount: ghs(0),
    tax: ghs(0),
  });

  const first = await confirmCash({
    store,
    actor: ACTOR,
    request: { transactionId: TX, cashReceived: ghs(2000) },
    context: context(CASH_KEY_A),
    now: NOW,
  });
  expect(first.ok).toBe(true);
  if (!first.ok) {
    throw new Error("expected initial cash confirmation");
  }
  expect(await store.listCashSales(TX)).toHaveLength(1);
  expect(await store.expectedCash(SHIFT_ID)).toEqual(ghs(11500));
  return { store, paymentId: first.data.paymentId };
}

async function expectRejectedWithoutSecondLedger(
  store: CheckoutStore,
  cashReceived: Money,
  expectedCode: string = "VALIDATION_ERROR",
) {
  const result = await confirmCash({
    store,
    actor: ACTOR,
    request: { transactionId: TX, cashReceived },
    context: context(CASH_KEY_B),
    now: NOW,
  });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe(expectedCode);
  }
  expect(await store.listCashSales(TX)).toHaveLength(1);
  expect(await store.expectedCash(SHIFT_ID)).toEqual(ghs(11500));
}

describe("CORE-05 existing cash evidence with a fresh idempotency key", () => {
  test("exactly matching cash evidence returns the recorded payment without another ledger effect", async () => {
    const { store, paymentId } = await setupPaidSale();
    const replay = await confirmCash({
      store,
      actor: ACTOR,
      request: { transactionId: TX, cashReceived: ghs(2000) },
      context: context(CASH_KEY_B),
      now: NOW,
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.data.paymentId).toBe(paymentId);
      expect(replay.data.status).toBe("verified");
    }
    expect(await store.listCashSales(TX)).toHaveLength(1);
    expect(await store.expectedCash(SHIFT_ID)).toEqual(ghs(11500));
  });

  test("wrong currency is rejected even when the transaction already has a payment", async () => {
    const { store } = await setupPaidSale();
    await expectRejectedWithoutSecondLedger(store, { minor: 2000, currency: "USD" });
  });

  test("underpayment is rejected even when the transaction already has a payment", async () => {
    const { store } = await setupPaidSale();
    await expectRejectedWithoutSecondLedger(store, ghs(1000));
  });

  test("materially different cash received is rejected instead of reusing recorded evidence", async () => {
    const { store } = await setupPaidSale();
    await expectRejectedWithoutSecondLedger(store, ghs(2500));
  });
});
