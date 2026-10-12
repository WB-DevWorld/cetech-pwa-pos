import { describe, expect, test } from "vitest";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createFakeElectronicPaymentProvider } from "../payments/fake-provider";
import { initializeElectronicPayment } from "../payments/initialize-electronic";
import { confirmCash as newConfirmCash } from "./confirm-cash";
import { confirmCash as oldConfirmCash } from "./fixtures/confirm-cash-452c446";

const NOW = new Date("2026-10-09T12:00:00Z");
const TX = "11111111-1111-4111-8111-111111111111";
const SHIFT = "66666666-6666-4666-8666-666666666666";
const ACTOR = {
  actorId: "manager_a",
  displayName: "Fixture",
  organizationId: "org_a",
  locationIds: ["loc_a"],
};
const ghs = (minor: number) => ({ minor, currency: "GHS" as const });
const context = (idempotencyKey: string) => ({
  idempotencyKey,
  correlationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
});

async function setup() {
  const store = createInMemoryCheckoutStore();
  await store.insertOpenShift({
    id: SHIFT,
    organizationId: "org_a",
    locationId: "loc_a",
    registerId: "reg_a",
    deviceId: "44444444-4444-4444-8444-444444444444",
    cashierId: ACTOR.actorId,
    status: "open",
    openingFloat: ghs(1000),
    expectedCash: ghs(1000),
    openedAt: NOW.toISOString(),
  });
  await store.seedPreparedSale({
    organizationId: "org_a",
    locationId: "loc_a",
    locationName: "Store",
    registerId: "reg_a",
    registerName: "Register A",
    deviceId: "44444444-4444-4444-8444-444444444444",
    shiftId: SHIFT,
    cashierId: ACTOR.actorId,
    cashierName: "Fixture",
    customer: { kind: "walkin" },
    customerLabel: "Walk-in",
    prepared: {
      transactionId: TX,
      saleId: `sale-${TX}`,
      orderReference: "1001",
      quoteFingerprint: "0123456789abcdef0123456789abcdef",
      total: ghs(1500),
      status: "prepared",
      stockCommitment: "reserved",
      preparedAt: NOW.toISOString(),
      expiresAt: "2026-10-09T13:00:00Z",
    },
    subtotal: ghs(1500),
    discount: ghs(0),
    tax: ghs(0),
    lines: [
      {
        name: "Synthetic item",
        quantity: "1",
        unitPrice: ghs(1500),
        subtotal: ghs(1500),
        discount: ghs(0),
        tax: ghs(0),
        total: ghs(1500),
      },
    ],
  });
  return store;
}

describe("TF-01 / R-F4-01 mixed-generation tender boundary", () => {
  test("new/new cash paused at claim loses to electronic with zero cash rows", async () => {
    const store = await setup();
    const provider = createFakeElectronicPaymentProvider();
    const claim = store.claimSaleTender.bind(store);
    let resume!: () => void;
    let arrived!: () => void;
    const paused = new Promise<void>((r) => {
      arrived = r;
    });
    const gate = new Promise<void>((r) => {
      resume = r;
    });
    store.claimSaleTender = async (tx, family, scope) => {
      if (family === "cash") {
        arrived();
        await gate;
      }
      return claim(tx, family, scope);
    };
    const pending = newConfirmCash({
      store,
      actor: ACTOR,
      request: { transactionId: TX, cashReceived: ghs(2000) },
      context: context("22222222-2222-4222-8222-222222222222"),
      now: NOW,
    });
    await paused;
    const electronic = await initializeElectronicPayment({
      store,
      provider,
      actor: ACTOR,
      request: { transactionId: TX, tender: "card" },
      context: context("33333333-3333-4333-8333-333333333333"),
      now: NOW,
      appEnv: "local",
      sandboxPayerEmail: "fixture@example.invalid",
      methodConfigured: true,
    });
    expect(electronic).toMatchObject({ ok: true, data: { tender: "card" } });
    resume();
    expect(await pending).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(await store.listCashSales(TX)).toHaveLength(0);
    expect(provider.initializeCount).toBe(1);
  });

  test("legacy 452c446 cash writer cannot leave cash+card after electronic claim", async () => {
    const store = await setup();
    const provider = createFakeElectronicPaymentProvider();
    const append = store.appendCashMovement.bind(store);
    let resume!: () => void;
    let arrived!: () => void;
    const paused = new Promise<void>((r) => {
      arrived = r;
    });
    const gate = new Promise<void>((r) => {
      resume = r;
    });
    store.appendCashMovement = async (movement) => {
      arrived();
      await gate;
      return append(movement);
    };
    const pending = oldConfirmCash({
      store,
      actor: ACTOR,
      request: { transactionId: TX, cashReceived: ghs(2000) },
      context: context("22222222-2222-4222-8222-222222222222"),
      now: NOW,
    });
    await paused;
    const electronic = await initializeElectronicPayment({
      store,
      provider,
      actor: ACTOR,
      request: { transactionId: TX, tender: "card" },
      context: context("33333333-3333-4333-8333-333333333333"),
      now: NOW,
      appEnv: "local",
      sandboxPayerEmail: "fixture@example.invalid",
      methodConfigured: true,
    });
    expect(electronic).toMatchObject({ ok: true, data: { tender: "card" } });
    resume();
    const cashResult = await pending;
    expect(cashResult.ok).toBe(false);
    expect(await store.listCashSales(TX)).toHaveLength(0);
    expect(provider.initializeCount).toBe(1);
    expect((await store.getPaymentForTransaction(TX))?.tender).toBe("card");
  });
});