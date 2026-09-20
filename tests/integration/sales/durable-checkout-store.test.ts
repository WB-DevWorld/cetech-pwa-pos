import { describe, expect, test } from "vitest";
import type { Quote, ReceiptSnapshot } from "../../../../docs/contracts/domain.generated";
import { composeCheckoutRuntime } from "../../../apps/pos-web/src/server/sales/compose-checkout-runtime";
import { createSupabaseCheckoutStore } from "../../../apps/pos-web/src/server/sales/supabase-checkout-store";
import type { PosRestFetch } from "../../../apps/pos-web/src/server/http/server-fetch";
import { createFakePosgrest } from "./fake-posgrest";

const DEVICE_ID = "00000000-0000-4000-8000-0000000000a1";
const TX = "11111111-1111-4111-8111-111111111111";
const SHIFT_ID = "55555555-5555-4555-8555-555555555555";
const PAYMENT_ID = "22222222-2222-4222-8222-222222222222";
const PREPARE_KEY = "66666666-6666-4666-8666-666666666666";
const HASH_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function intentSnapshot(name: string, sku: string) {
  return {
    kind: "sale.prepare.presentation" as const,
    quoteId: "quote-r6-1",
    quoteFingerprint: "0123456789abcdef0123456789abcdef",
    transactionId: TX,
    lineIds: ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
    lines: [
      {
        name,
        sku,
        quantity: "1",
        unitPrice: { minor: 2900, currency: "GHS" as const },
        subtotal: { minor: 2900, currency: "GHS" as const },
        discount: { minor: 0, currency: "GHS" as const },
        tax: { minor: 0, currency: "GHS" as const },
        total: { minor: 2900, currency: "GHS" as const },
      },
    ],
  };
}

function restFrom(
  handler: (input: string, init: Parameters<PosRestFetch>[1]) => Promise<{ status: number; body?: unknown }>,
): PosRestFetch {
  return async (input, init) => {
    const result = await handler(input, init);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.body ?? [],
    };
  };
}

function quote(): Quote {
  const total = { minor: 2900, currency: "GHS" as const };
  const zero = { minor: 0, currency: "GHS" as const };
  return {
    id: "quote-r6-1",
    fingerprint: "0123456789abcdef0123456789abcdef",
    cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    cartRevision: 1,
    customer: { kind: "walkin" },
    locationId: "loc_a1",
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
    expiresAt: "2026-09-15T18:00:00.000Z",
    purchasable: true,
  };
}

function receipt(): ReceiptSnapshot {
  const total = { minor: 2900, currency: "GHS" as const };
  const zero = { minor: 0, currency: "GHS" as const };
  return {
    id: "receipt-r6-1",
    transactionId: TX,
    receiptNumber: "R-1",
    orderReference: "woo-49111",
    issuedAt: "2026-09-15T12:05:00.000Z",
    locationName: "loc_a1",
    registerName: "Register A",
    cashierName: "Cashier A",
    customerLabel: "Walk-in",
    lines: [
      {
        name: "Hardener",
        quantity: "1",
        unitPrice: total,
        subtotal: total,
        discount: zero,
        tax: zero,
        total,
      },
    ],
    subtotal: total,
    discount: zero,
    tax: zero,
    total,
    tender: "cash",
    cashReceived: { minor: 3000, currency: "GHS" },
    changeDue: { minor: 100, currency: "GHS" },
    documentKind: "operational_pos_receipt",
  };
}

describe("R6-REM-01 durable checkout store", () => {
  test("ephemeral store is refused for staging and production", () => {
    expect(() => composeCheckoutRuntime({ APP_ENV: "staging" })).toThrow(/durable checkout store is required/);
    expect(() =>
      composeCheckoutRuntime(
        { APP_ENV: "production", SUPABASE_URL: "https://example.supabase.co" },
        restFrom(async () => ({ status: 200 })),
      ),
    ).toThrow(/durable checkout store is required/);
    expect(() => composeCheckoutRuntime({ APP_ENV: "local" })).not.toThrow();
  });

  test("process restart recovers quote, sale, payment, receipt, cash, and idempotency without a second effect", async () => {
    const fake = createFakePosgrest();
    const first = createSupabaseCheckoutStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: fake.fetchImpl,
    });
    await first.seedRegister({
      id: "reg_a",
      name: "Register A",
      locationId: "loc_a1",
      currency: "GHS",
      status: "active",
      organizationId: "org_a",
    });
    await first.seedDevice({
      id: DEVICE_ID,
      organizationId: "org_a",
      locationId: "loc_a1",
      status: "active",
    });
    expect(
      await first.insertOpenShift({
        id: SHIFT_ID,
        registerId: "reg_a",
        deviceId: DEVICE_ID,
        cashierId: "cashier_a",
        status: "open",
        openingFloat: { minor: 10000, currency: "GHS" },
        expectedCash: { minor: 10000, currency: "GHS" },
        openedAt: "2026-09-15T12:00:00.000Z",
        organizationId: "org_a",
        locationId: "loc_a1",
      }),
    ).toBe("ok");
    await first.saveQuote(quote());
    const prepared = await first.seedPreparedSale({
      organizationId: "org_a",
      locationId: "loc_a1",
      locationName: "loc_a1",
      registerId: "reg_a",
      registerName: "Register A",
      deviceId: DEVICE_ID,
      shiftId: SHIFT_ID,
      cashierId: "cashier_a",
      cashierName: "Cashier A",
      customer: { kind: "walkin" },
      customerLabel: "Walk-in",
      prepared: {
        transactionId: TX,
        saleId: "woo-49111",
        orderReference: "woo-49111",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
        total: { minor: 2900, currency: "GHS" },
        status: "prepared",
        stockCommitment: "reserved",
        preparedAt: "2026-09-15T12:01:00.000Z",
        expiresAt: "2026-09-15T18:00:00.000Z",
      },
      lines: receipt().lines,
      subtotal: { minor: 2900, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
    });
    expect(
      await first.appendCashMovement({
        id: "77777777-7777-4777-8777-777777777777",
        organizationId: "org_a",
        shiftId: SHIFT_ID,
        kind: "cash_sale",
        signedAmount: { minor: 2900, currency: "GHS" },
        actorId: "cashier_a",
        createdAt: "2026-09-15T12:02:00.000Z",
        transactionId: TX,
        reason: "cash sale",
      }),
    ).toBe("ok");
    await first.savePayment({
      paymentId: PAYMENT_ID,
      transactionId: TX,
      saleId: "woo-49111",
      evidenceId: "88888888-8888-4888-8888-888888888888",
      tender: "cash",
      status: "verified",
      amount: { minor: 2900, currency: "GHS" },
      cashReceived: { minor: 3000, currency: "GHS" },
      verifiedAt: "2026-09-15T12:02:00.000Z",
      verificationSource: "cash_ledger",
      actorId: "cashier_a",
    });
    await first.saveSale({ ...prepared, status: "completed", assignedPaymentId: PAYMENT_ID, commercialConfirmed: true });
    expect(await first.saveReceipt(receipt())).toBe("ok");
    expect(
      await first.claimIdempotency("org_a", "sale.prepare", PREPARE_KEY, HASH_A, "loc_a1", {
        registerId: "reg_a",
        shiftId: SHIFT_ID,
        transactionId: TX,
      }),
    ).toEqual({
      kind: "acquired",
    });
    await first.acknowledgeIdempotency("org_a", "sale.prepare", PREPARE_KEY, prepared.prepared);

    const restarted = createSupabaseCheckoutStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: fake.fetchImpl,
    });
    await expect(restarted.getQuote("quote-r6-1")).resolves.toMatchObject({ id: "quote-r6-1", total: { minor: 2900 } });
    const recoveredSale = await restarted.getSale(TX);
    expect(recoveredSale?.status).toBe("completed");
    expect(recoveredSale?.prepared.saleId).toBe("woo-49111");
    expect(recoveredSale?.commercialConfirmed).toBe(true);
    await expect(restarted.getPaymentForTransaction(TX)).resolves.toMatchObject({ paymentId: PAYMENT_ID });
    fake.tables.pos_checkout_payments[0]!.verified_at = "2026-09-15T12:02:00+00:00";
    await expect(restarted.getPayment(PAYMENT_ID)).resolves.toMatchObject({
      paymentId: PAYMENT_ID,
      verifiedAt: "2026-09-15T12:02:00.000Z",
    });
    await expect(restarted.getReceipt(TX)).resolves.toMatchObject({ id: "receipt-r6-1" });
    await expect(restarted.listCashSales(TX)).resolves.toHaveLength(1);
    await expect(restarted.expectedCash(SHIFT_ID)).resolves.toEqual({ minor: 12900, currency: "GHS" });
    expect(await restarted.lookupCommandScope({ transactionId: TX, operation: "sale.prepare" })).toMatchObject({
      organizationId: "org_a",
      locationId: "loc_a1",
      registerId: "reg_a",
      shiftId: SHIFT_ID,
      transactionId: TX,
    });
    expect(await restarted.claimIdempotency("org_a", "sale.prepare", PREPARE_KEY, HASH_A, "loc_a1")).toMatchObject({
      kind: "replay",
    });
    expect(await restarted.claimIdempotency("org_a", "sale.prepare", PREPARE_KEY, HASH_B, "loc_a1")).toEqual({
      kind: "conflict",
    });
    expect(
      await restarted.appendCashMovement({
        id: "99999999-9999-4999-8999-999999999999",
        organizationId: "org_a",
        shiftId: SHIFT_ID,
        kind: "cash_sale",
        signedAmount: { minor: 2900, currency: "GHS" },
        actorId: "cashier_a",
        createdAt: "2026-09-15T12:03:00.000Z",
        transactionId: TX,
        reason: "cash sale",
      }),
    ).toBe("duplicate_sale");
    expect(
      await restarted.saveReceipt({
        ...receipt(),
        id: "receipt-r6-other",
      }),
    ).toBe("duplicate");
    expect(await restarted.listCashSales(TX)).toHaveLength(1);
  });

  test("prepare intent snapshot is append-once, org-scoped, and independent of outcome", async () => {
    const fake = createFakePosgrest();
    const store = createSupabaseCheckoutStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: fake.fetchImpl,
    });
    expect(
      await store.claimIdempotency("org_a", "sale.prepare", PREPARE_KEY, HASH_A, "loc_a1", {
        registerId: "reg_a",
        shiftId: SHIFT_ID,
        transactionId: TX,
      }),
    ).toEqual({ kind: "acquired" });
    const first = intentSnapshot("Training Product 49111", "SKU-49111");
    const changed = intentSnapshot("CHANGED NAME", "CHANGED-SKU");
    await expect(store.bindPrepareIntent("org_a", "sale.prepare", PREPARE_KEY, first)).resolves.toEqual(first);
    await expect(store.bindPrepareIntent("org_a", "sale.prepare", PREPARE_KEY, first)).resolves.toEqual(first);
    await expect(store.bindPrepareIntent("org_a", "sale.prepare", PREPARE_KEY, changed)).resolves.toEqual(first);
    expect(await store.getPrepareIntent("org_a", "sale.prepare", PREPARE_KEY)).toEqual(first);
    expect(await store.getPrepareIntent("org_b", "sale.prepare", PREPARE_KEY)).toBeUndefined();
    await store.acknowledgeIdempotency("org_a", "sale.prepare", PREPARE_KEY, { status: "prepared" });
    expect(await store.getPrepareIntent("org_a", "sale.prepare", PREPARE_KEY)).toEqual(first);
    expect(fake.tables.pos_pending_operations[0]?.outcome).toEqual({ status: "prepared" });
    expect(fake.tables.pos_pending_operations[0]?.intent_snapshot).toEqual(first);
  });

  test("concurrent A/B binds keep the first durable snapshot", async () => {
    const fake = createFakePosgrest();
    let armRace = false;
    let pendingGets = 0;
    let releaseGets!: () => void;
    let releasedGets = false;
    const bothObservedNull = new Promise<void>((resolve) => {
      releaseGets = resolve;
    });
    let aPatched = false;
    let releaseBPatch!: () => void;
    const aPatchDone = new Promise<void>((resolve) => {
      releaseBPatch = resolve;
    });
    const fetchImpl: PosRestFetch = async (input, init) => {
      const method = (init.method ?? "GET").toUpperCase();
      const url = String(input);
      if (
        armRace &&
        method === "GET" &&
        url.includes("pos_pending_operations") &&
        url.includes("select=request_hash,status,outcome,intent_snapshot") &&
        !releasedGets
      ) {
        pendingGets += 1;
        if (pendingGets >= 2) {
          releasedGets = true;
          releaseGets();
        }
        await bothObservedNull;
      }
      if (armRace && method === "PATCH" && url.includes("intent_snapshot=is.null")) {
        const body = init.body ? (JSON.parse(init.body) as { intent_snapshot?: { lines?: Array<{ name?: string }> } }) : {};
        const name = body.intent_snapshot?.lines?.[0]?.name;
        if (name === "PRESENTATION B" && !aPatched) {
          await aPatchDone;
        }
        const result = await fake.fetchImpl(input, init);
        if (name === "PRESENTATION A") {
          aPatched = true;
          releaseBPatch();
        }
        return result;
      }
      return fake.fetchImpl(input, init);
    };
    const storeA = createSupabaseCheckoutStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl,
    });
    const storeB = createSupabaseCheckoutStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl,
    });
    expect(
      await storeA.claimIdempotency("org_a", "sale.prepare", PREPARE_KEY, HASH_A, "loc_a1", {
        registerId: "reg_a",
        shiftId: SHIFT_ID,
        transactionId: TX,
      }),
    ).toEqual({ kind: "acquired" });
    const snapshotA = intentSnapshot("PRESENTATION A", "SKU-A");
    const snapshotB = intentSnapshot("PRESENTATION B", "SKU-B");
    armRace = true;
    const [boundA, boundB] = await Promise.all([
      storeA.bindPrepareIntent("org_a", "sale.prepare", PREPARE_KEY, snapshotA),
      storeB.bindPrepareIntent("org_a", "sale.prepare", PREPARE_KEY, snapshotB),
    ]);
    expect(boundA).toEqual(snapshotA);
    expect(boundB).toEqual(snapshotA);
    expect(fake.tables.pos_pending_operations[0]?.intent_snapshot).toEqual(snapshotA);
    expect(await storeB.getPrepareIntent("org_a", "sale.prepare", PREPARE_KEY)).toEqual(snapshotA);
  });

  test("direct replace or clear of a bound intent is rejected and leaves A", async () => {
    const fake = createFakePosgrest();
    const store = createSupabaseCheckoutStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: fake.fetchImpl,
    });
    expect(
      await store.claimIdempotency("org_a", "sale.prepare", PREPARE_KEY, HASH_A, "loc_a1", {
        registerId: "reg_a",
        shiftId: SHIFT_ID,
        transactionId: TX,
      }),
    ).toEqual({ kind: "acquired" });
    const snapshotA = intentSnapshot("PRESENTATION A", "SKU-A");
    await expect(store.bindPrepareIntent("org_a", "sale.prepare", PREPARE_KEY, snapshotA)).resolves.toEqual(snapshotA);
    const replace = await fake.fetchImpl(
      "https://example.supabase.co/rest/v1/pos_pending_operations?organization_id=eq.org_a&operation=eq.sale.prepare&idempotency_key=eq." +
        PREPARE_KEY,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ intent_snapshot: intentSnapshot("PRESENTATION B", "SKU-B") }),
      },
    );
    expect(replace.status).toBe(500);
    expect(await replace.json()).toMatchObject({ code: "55000" });
    const clear = await fake.fetchImpl(
      "https://example.supabase.co/rest/v1/pos_pending_operations?organization_id=eq.org_a&operation=eq.sale.prepare&idempotency_key=eq." +
        PREPARE_KEY,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ intent_snapshot: null }),
      },
    );
    expect(clear.status).toBe(500);
    expect(fake.tables.pos_pending_operations[0]?.intent_snapshot).toEqual(snapshotA);
    await expect(store.bindPrepareIntent("org_a", "sale.prepare", PREPARE_KEY, intentSnapshot("PRESENTATION B", "SKU-B"))).resolves.toEqual(
      snapshotA,
    );
  });
});
