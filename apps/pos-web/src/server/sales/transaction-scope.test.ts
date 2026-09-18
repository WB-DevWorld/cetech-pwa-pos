import { describe, expect, test } from "vitest";
import type {
  CommandContext,
  PreparedSale,
  PrepareSaleRequest,
  Quote,
  SaleResolution,
} from "../../../../../docs/contracts/domain.generated";
import type { SalesPort } from "../../../../../docs/contracts/ports";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import type { CheckoutStore, StaffActor } from "../../core/checkout/types";
import { createMemoryCatalogPresentationLookup } from "../../core/receipt/catalog-presentation";
import { createMemoryReceiptSettingsStore } from "../../core/receipt/settings-store";
import { prepareSale } from "./prepare-sale";
import { resolveSale } from "./resolve-sale";

const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" as const;
const PREPARE_KEY = "22222222-2222-4222-8222-222222222222" as const;
const PREPARE_KEY_2 = "22222222-2222-4222-8222-222222222223" as const;
const TX_A = "11111111-1111-4111-8111-111111111111" as const;
const DEVICE_A = "44444444-4444-4444-8444-444444444444";
const DEVICE_B = "44444444-4444-4444-8444-444444444445";
const SHIFT_A = "55555555-5555-4555-8555-555555555555";
const SHIFT_B = "55555555-5555-4555-8555-555555555556";
const NOW = new Date("2026-09-15T12:00:00.000Z");
const FINGERPRINT = "0123456789abcdef0123456789abcdef";
const catalogLookup = createMemoryCatalogPresentationLookup({
  org_a: [{ id: "49111", name: "Training Product 49111", sku: "SKU-49111", kind: "simple" }],
  org_b: [{ id: "49111", name: "Training Product 49111", sku: "SKU-49111", kind: "simple" }],
});
const receiptSettings = createMemoryReceiptSettingsStore();

const ACTOR_A: StaffActor = {
  actorId: "cashier_a",
  displayName: "Cashier A",
  organizationId: "org_a",
  locationIds: ["loc_a1"],
};

const ACTOR_A_LOC_B: StaffActor = {
  actorId: "cashier_a2",
  displayName: "Cashier A2",
  organizationId: "org_a",
  locationIds: ["loc_a2"],
};

const ACTOR_B: StaffActor = {
  actorId: "cashier_b",
  displayName: "Cashier B",
  organizationId: "org_b",
  locationIds: ["loc_b1"],
};

function ghs(minor: number) {
  return { minor, currency: "GHS" as const };
}

function quoteAt(locationId: string, id = "quote-a"): Quote {
  const total = ghs(2900);
  const zero = ghs(0);
  return {
    id,
    fingerprint: FINGERPRINT,
    cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    cartRevision: 1,
    customer: { kind: "walkin" },
    locationId,
    currency: "GHS",
    lines: [
      {
        lineId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        productId: "49111",
        quantity: "1",
        unitPrice: total,
        subtotal: total,
        discount: zero,
        tax: zero,
        total,
        stockStatus: "in_stock",
        purchasable: true,
        problems: [],
      },
    ],
    subtotal: total,
    discount: zero,
    tax: zero,
    total,
    calculatedAt: "2026-09-15T12:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    purchasable: true,
  };
}

function request(shiftId: string, registerId = "reg_a1", deviceId = DEVICE_A): PrepareSaleRequest {
  return {
    transactionId: TX_A,
    registerId,
    shiftId,
    deviceId,
    quoteId: "quote-a",
    quoteFingerprint: FINGERPRINT,
  };
}

function context(key: string = PREPARE_KEY): CommandContext {
  return { idempotencyKey: key, correlationId: CORRELATION };
}

async function seedScopedStore(): Promise<CheckoutStore> {
  const store = createInMemoryCheckoutStore();
  await store.seedRegister({
    id: "reg_a1",
    name: "Register A1",
    locationId: "loc_a1",
    currency: "GHS",
    status: "active",
    organizationId: "org_a",
  });
  await store.seedRegister({
    id: "reg_a2",
    name: "Register A2",
    locationId: "loc_a1",
    currency: "GHS",
    status: "active",
    organizationId: "org_a",
  });
  await store.seedRegister({
    id: "reg_b1",
    name: "Register B1",
    locationId: "loc_a2",
    currency: "GHS",
    status: "active",
    organizationId: "org_a",
  });
  await store.seedRegister({
    id: "reg_org_b",
    name: "Register Org B",
    locationId: "loc_b1",
    currency: "GHS",
    status: "active",
    organizationId: "org_b",
  });
  await store.seedDevice({ id: DEVICE_A, organizationId: "org_a", locationId: "loc_a1", status: "active" });
  await store.seedDevice({ id: DEVICE_B, organizationId: "org_a", locationId: "loc_a2", status: "active" });
  await store.insertOpenShift({
    id: SHIFT_A,
    registerId: "reg_a1",
    deviceId: DEVICE_A,
    cashierId: "cashier_a",
    status: "open",
    openingFloat: ghs(10000),
    expectedCash: ghs(10000),
    openedAt: "2026-09-15T11:00:00.000Z",
    organizationId: "org_a",
    locationId: "loc_a1",
  });
  await store.insertOpenShift({
    id: SHIFT_B,
    registerId: "reg_b1",
    deviceId: DEVICE_B,
    cashierId: "cashier_a2",
    status: "open",
    openingFloat: ghs(10000),
    expectedCash: ghs(10000),
    openedAt: "2026-09-15T11:00:00.000Z",
    organizationId: "org_a",
    locationId: "loc_a2",
  });
  await store.saveQuote(quoteAt("loc_a1"));
  await store.saveQuote(quoteAt("loc_a2", "quote-a2"));
  return store;
}

function countingPort(options?: {
  readonly dropPrepare?: boolean;
  readonly prepared?: PreparedSale;
}): Pick<SalesPort, "prepare" | "resolve"> & { prepareCount: number; resolveCount: number } {
  const prepared =
    options?.prepared ??
    ({
      transactionId: TX_A,
      saleId: "woo-1",
      orderReference: "woo-1",
      quoteFingerprint: FINGERPRINT,
      total: ghs(2900),
      status: "prepared",
      stockCommitment: "reserved",
      preparedAt: "2026-09-15T12:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
    } satisfies PreparedSale);
  const port = {
    prepareCount: 0,
    resolveCount: 0,
    async prepare(): Promise<{ ok: true; data: PreparedSale; correlationId: typeof CORRELATION }> {
      port.prepareCount += 1;
      if (options?.dropPrepare) {
        throw new Error("injected lost prepare response");
      }
      return { ok: true, data: prepared, correlationId: CORRELATION };
    },
    async resolve(): Promise<{ ok: true; data: SaleResolution; correlationId: typeof CORRELATION }> {
      port.resolveCount += 1;
      return {
        ok: true,
        data: {
          transactionId: TX_A,
          status: "prepared",
          saleId: prepared.saleId,
          orderReference: prepared.orderReference,
        },
        correlationId: CORRELATION,
      };
    },
  };
  return port;
}

describe("R6-REM-02 transaction scope binding", () => {
  test("cross-organization transactionId is FORBIDDEN and does not call Woo resolve", async () => {
    const store = await seedScopedStore();
    await store.seedPreparedSale({
      organizationId: "org_b",
      locationId: "loc_b1",
      locationName: "loc_b1",
      registerId: "reg_org_b",
      registerName: "Register Org B",
      deviceId: DEVICE_A,
      shiftId: SHIFT_A,
      cashierId: "cashier_b",
      cashierName: "Cashier B",
      customer: { kind: "walkin" },
      customerLabel: "Walk-in",
      prepared: {
        transactionId: TX_A,
        saleId: "woo-secret",
        orderReference: "woo-secret",
        quoteFingerprint: FINGERPRINT,
        total: ghs(2900),
        status: "prepared",
        stockCommitment: "reserved",
        preparedAt: "2026-09-15T12:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
      lines: [],
      subtotal: ghs(2900),
      discount: ghs(0),
      tax: ghs(0),
    });
    const salesPort = countingPort();
    const prepared = await prepareSale({
      store,
      salesPort,
      catalogLookup,
      receiptSettings,
      actor: ACTOR_A,
      request: request(SHIFT_A),
      context: context(),
      now: NOW,
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.code).toBe("FORBIDDEN");
    }
    const resolved = await resolveSale({
      store,
      salesPort,
      actor: ACTOR_A,
      transactionId: TX_A,
      correlationId: CORRELATION,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe("FORBIDDEN");
    }
    expect(salesPort.prepareCount).toBe(0);
    expect(salesPort.resolveCount).toBe(0);
  });

  test("same-organization unauthorized location cannot recover the sale", async () => {
    const store = await seedScopedStore();
    const salesPort = countingPort();
    const first = await prepareSale({
      store,
      salesPort,
      catalogLookup,
      receiptSettings,
      actor: ACTOR_A,
      request: request(SHIFT_A),
      context: context(),
      now: NOW,
    });
    expect(first.ok).toBe(true);
    const replay = await prepareSale({
      store,
      salesPort,
      catalogLookup,
      receiptSettings,
      actor: ACTOR_A_LOC_B,
      request: { ...request(SHIFT_B, "reg_b1", DEVICE_B), quoteId: "quote-a2" },
      context: context(PREPARE_KEY_2),
      now: NOW,
    });
    expect(replay.ok).toBe(false);
    if (!replay.ok) {
      expect(replay.error.code).toBe("FORBIDDEN");
    }
    const resolved = await resolveSale({
      store,
      salesPort,
      actor: ACTOR_A_LOC_B,
      transactionId: TX_A,
      correlationId: CORRELATION,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe("FORBIDDEN");
    }
    expect(salesPort.prepareCount).toBe(1);
    expect(salesPort.resolveCount).toBe(0);
  });

  test("wrong register replay is denied", async () => {
    const store = await seedScopedStore();
    const salesPort = countingPort();
    const first = await prepareSale({
      store,
      salesPort,
      catalogLookup,
      receiptSettings,
      actor: ACTOR_A,
      request: request(SHIFT_A, "reg_a1"),
      context: context(),
      now: NOW,
    });
    expect(first.ok).toBe(true);
    const wrongRegister = await prepareSale({
      store,
      salesPort,
      catalogLookup,
      receiptSettings,
      actor: ACTOR_A,
      request: request(SHIFT_A, "reg_a2"),
      context: context(PREPARE_KEY_2),
      now: NOW,
    });
    expect(wrongRegister.ok).toBe(false);
    if (!wrongRegister.ok) {
      expect(wrongRegister.error.code).toBe("FORBIDDEN");
    }
    expect(salesPort.prepareCount).toBe(1);
  });

  test("wrong shift replay is denied", async () => {
    const store = await seedScopedStore();
    const salesPort = countingPort();
    const first = await prepareSale({
      store,
      salesPort,
      catalogLookup,
      receiptSettings,
      actor: ACTOR_A,
      request: request(SHIFT_A),
      context: context(),
      now: NOW,
    });
    expect(first.ok).toBe(true);
    const wrongShift = await prepareSale({
      store,
      salesPort,
      catalogLookup,
      receiptSettings,
      actor: ACTOR_A,
      request: request(SHIFT_B),
      context: context(PREPARE_KEY_2),
      now: NOW,
    });
    expect(wrongShift.ok).toBe(false);
    if (!wrongShift.ok) {
      expect(wrongShift.error.code).toBe("FORBIDDEN");
    }
    expect(salesPort.prepareCount).toBe(1);
  });

  test("remote resolve without a local prepare binding does not call the bridge", async () => {
    const store = await seedScopedStore();
    const salesPort = countingPort();
    const resolved = await resolveSale({
      store,
      salesPort,
      actor: ACTOR_A,
      transactionId: TX_A,
      correlationId: CORRELATION,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe("NOT_FOUND");
    }
    expect(salesPort.resolveCount).toBe(0);
    expect(await store.getSale(TX_A)).toBeUndefined();
  });

  test("legitimate lost prepare response recovers the existing Woo order", async () => {
    const store = await seedScopedStore();
    const salesPort = countingPort({ dropPrepare: true });
    const lost = await prepareSale({
      store,
      salesPort,
      catalogLookup,
      receiptSettings,
      actor: ACTOR_A,
      request: request(SHIFT_A),
      context: context(),
      now: NOW,
    });
    expect(lost.ok).toBe(true);
    if (!lost.ok) {
      throw new Error("expected recovered prepare");
    }
    expect(lost.data.saleId).toBe("woo-1");
    expect(salesPort.prepareCount).toBe(1);
    expect(salesPort.resolveCount).toBe(1);
    expect((await store.getSale(TX_A))?.prepared.saleId).toBe("woo-1");
    const replay = await prepareSale({
      store,
      salesPort: countingPort(),
      catalogLookup,
      receiptSettings,
      actor: ACTOR_A,
      request: request(SHIFT_A),
      context: context(),
      now: NOW,
    });
    expect(replay.ok).toBe(true);
    if (replay.ok) {
      expect(replay.data.saleId).toBe("woo-1");
    }
  });

  test("org B cannot use a lost-response binding belonging to org A as a Woo oracle", async () => {
    const store = await seedScopedStore();
    const salesPort = countingPort({ dropPrepare: true });
    const lost = await prepareSale({
      store,
      salesPort,
      catalogLookup,
      receiptSettings,
      actor: ACTOR_A,
      request: request(SHIFT_A),
      context: context(),
      now: NOW,
    });
    expect(lost.ok).toBe(true);
    const spy = countingPort();
    const resolved = await resolveSale({
      store,
      salesPort: spy,
      actor: ACTOR_B,
      transactionId: TX_A,
      correlationId: CORRELATION,
    });
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) {
      expect(resolved.error.code).toBe("FORBIDDEN");
    }
    expect(spy.resolveCount).toBe(0);
  });
});
