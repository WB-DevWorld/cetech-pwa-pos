import { describe, expect, test } from "vitest";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createMemoryReceiptSettingsStore } from "../../core/receipt/settings-store";
import { createSupabaseCheckoutStore } from "./supabase-checkout-store";
import { confirmCash } from "./confirm-cash";
import { finalizeSale } from "./finalize-sale";
import { initializeElectronicPayment } from "../payments/initialize-electronic";
import { createFakeElectronicPaymentProvider } from "../payments/fake-provider";
import { resolveElectronicPayment } from "../payments/resolve-electronic";
const NOW = new Date("2026-10-09T12:00:00Z");
const TX = "11111111-1111-4111-8111-111111111111";
const TX2 = "11111111-1111-4111-8111-111111111112";
const SHIFT = "66666666-6666-4666-8666-666666666666";
const ACTOR = {
  actorId: "manager_a",
  displayName: "Fixture",
  organizationId: "org_a",
  locationIds: ["loc_a"],
};
const ghs = (minor: number) => ({ minor, currency: "GHS" as const });
const context = (idempotencyKey = "22222222-2222-4222-8222-222222222222") => ({
  idempotencyKey,
  correlationId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
});

async function setup(tx = TX) {
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
  await seed(store, tx);
  return store;
}

async function seed(store: ReturnType<typeof createInMemoryCheckoutStore>, tx: string) {
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
      transactionId: tx,
      saleId: `sale-${tx}`,
      orderReference: tx === TX ? "1001" : "1002",
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
}

const cash = (store: ReturnType<typeof createInMemoryCheckoutStore>, tx = TX) =>
  confirmCash({
    store,
    actor: ACTOR,
    request: { transactionId: tx, cashReceived: ghs(2000) },
    context: context(tx === TX ? "22222222-2222-4222-8222-222222222222" : "22222222-2222-4222-8222-222222222223"),
    now: NOW,
  });

const electronic = (
  store: ReturnType<typeof createInMemoryCheckoutStore>,
  provider: ReturnType<typeof createFakeElectronicPaymentProvider>,
) =>
  initializeElectronicPayment({
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

describe("TF-01 / TF-02 tender and receipt integrity (repaired)", () => {
  test("normal durable cash payment prevents electronic initialization", async () => {
    const store = await setup();
    const provider = createFakeElectronicPaymentProvider();
    expect(await cash(store)).toMatchObject({ ok: true, data: { status: "verified" } });
    expect(await electronic(store, provider)).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(provider.initializeCount).toBe(0);
    expect(await store.listCashSales(TX)).toHaveLength(1);
  });

  test("payment write loss rolls back cash movement and still excludes electronic tender", async () => {
    const store = await setup();
    const provider = createFakeElectronicPaymentProvider();
    store.failNextPaymentWrite = true;
    expect(await cash(store)).toMatchObject({ ok: true, data: { status: "requires_attention" } });
    expect(await store.listCashSales(TX)).toHaveLength(0);
    expect(await store.getPaymentForTransaction(TX)).toBeUndefined();
    expect(await store.expectedCash(SHIFT)).toEqual(ghs(1000));
    expect(await electronic(store, provider)).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(provider.initializeCount).toBe(0);
  });

  test("interleaved cash after electronic claim refuses cash ledger", async () => {
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
    store.claimSaleTender = async (transactionId, family, scope) => {
      if (family === "cash") {
        arrived();
        await gate;
      }
      return claim(transactionId, family, scope);
    };
    const cashPending = cash(store);
    await paused;
    expect(await electronic(store, provider)).toMatchObject({ ok: true, data: { tender: "card" } });
    resume();
    expect(await cashPending).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(await store.listCashSales(TX)).toHaveLength(0);
    expect((await store.getPaymentForTransaction(TX))?.tender).toBe("card");
    expect(provider.initializeCount).toBe(1);
  });

  test.each([true, false])(
    "shared-prefix receipt collision=%s both persist with full UUID ids",
    async (collision) => {
      const secondTx = collision ? TX2 : "44444444-1111-4111-8111-111111111112";
      const store = await setup();
      await seed(store, secondTx);
      const rowsById = new Map<string, { id: string; transaction_id: string; organization_id: string; location_id: string }>();
      let conflicts = 0;
      const adapter = createSupabaseCheckoutStore({
        url: "https://fixture.invalid",
        serviceRoleKey: "synthetic-test-only",
        fetchImpl: async (url, init) => {
          const u = new URL(String(url));
          const table = u.pathname.split("/").pop();
          if (table === "pos_checkout_sales") return new Response("[]", { status: 200 });
          if (table === "pos_sale_tender_claims" && init?.method === "POST") {
            return new Response(null, { status: 201 });
          }
          if (table === "pos_sale_tender_claims") {
            return new Response("[]", { status: 200 });
          }
          if (table === "pos_checkout_receipts" && init?.method === "POST") {
            const row = JSON.parse(String(init.body));
            expect(row.organization_id).toBe("org_a");
            expect(row.location_id).toBe("loc_a");
            expect(String(row.id)).toMatch(/^rcpt-[0-9a-f-]{36}$/);
            if (rowsById.has(row.id)) {
              conflicts += 1;
              return new Response(
                JSON.stringify({ code: "23505", message: "duplicate key violates pos_checkout_receipts_pkey" }),
                { status: 409 },
              );
            }
            rowsById.set(row.id, row);
            return new Response(null, { status: 201 });
          }
          if (table === "pos_checkout_receipts") {
            const tx = u.searchParams.get("transaction_id")?.slice(3);
            return new Response(
              JSON.stringify(
                [...rowsById.values()]
                  .filter((r) => r.transaction_id === tx)
                  .map((r) => ({
                    snapshot: {
                      id: r.id,
                      transactionId: r.transaction_id,
                      receiptNumber: `POS-${r.transaction_id === TX ? "1001" : "1002"}`,
                      orderReference: r.transaction_id === TX ? "1001" : "1002",
                      issuedAt: NOW.toISOString(),
                      locationName: "Store",
                      registerName: "Register A",
                      cashierName: "Fixture",
                      customerLabel: "Walk-in",
                      presentation: { paperWidthMm: 80, showSku: true, showTax: true, footerText: "" },
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
                      subtotal: ghs(1500),
                      discount: ghs(0),
                      tax: ghs(0),
                      total: ghs(1500),
                      tender: "cash",
                      documentKind: "operational_pos_receipt",
                      cashReceived: ghs(2000),
                      changeDue: ghs(500),
                    },
                  })),
              ),
              { status: 200 },
            );
          }
          throw new Error(`unexpected fixture request ${u.pathname}`);
        },
      });
      adapter.getSale = store.getSale.bind(store);
      store.saveReceipt = adapter.saveReceipt.bind(adapter);
      store.getReceipt = adapter.getReceipt.bind(adapter);
      const settings = createMemoryReceiptSettingsStore();
      const salesPort = {
        confirmPayment: async (request: { transactionId: string }, ctx: { correlationId: string }) => ({
          ok: true as const,
          correlationId: ctx.correlationId,
          data: { transactionId: request.transactionId, status: "completed" as const },
        }),
      };
      for (const [tx, key] of [
        [TX, "33333333-3333-4333-8333-333333333333"],
        [secondTx, "33333333-3333-4333-8333-333333333334"],
      ] as const) {
        const tender = await cash(store, tx);
        if (!tender.ok) throw new Error("cash fixture failed");
        const result = await finalizeSale({
          store,
          salesPort,
          receiptSettings: settings,
          actor: ACTOR,
          request: { transactionId: tx, paymentId: tender.data.paymentId },
          context: context(key),
          now: NOW,
        });
        expect(result).toMatchObject({
          ok: true,
          data: { status: "completed", receiptId: `rcpt-${tx}` },
        });
      }
      expect(conflicts).toBe(0);
      expect(rowsById.size).toBe(2);
      expect(rowsById.has(`rcpt-${TX}`)).toBe(true);
      expect(rowsById.has(`rcpt-${secondTx}`)).toBe(true);
      expect(await store.getReceipt(TX)).toMatchObject({ id: `rcpt-${TX}` });
      expect(await store.getReceipt(secondTx)).toMatchObject({ id: `rcpt-${secondTx}` });
      expect((await store.getSale(secondTx))?.status).toBe("completed");
      void collision;
    },
  );

  test("unrelated receipt 409 without same-transaction row stays attention", async () => {
    const store = await setup();
    const adapter = createSupabaseCheckoutStore({
      url: "https://fixture.invalid",
      serviceRoleKey: "synthetic-test-only",
      fetchImpl: async (url, init) => {
        const u = new URL(String(url));
        const table = u.pathname.split("/").pop();
        if (table === "pos_checkout_sales") return new Response("[]", { status: 200 });
        if (table === "pos_checkout_receipts" && init?.method === "POST") {
          return new Response(JSON.stringify({ code: "23505", message: "duplicate key" }), { status: 409 });
        }
        if (table === "pos_checkout_receipts") {
          return new Response("[]", { status: 200 });
        }
        throw new Error(`unexpected ${u.pathname}`);
      },
    });
    adapter.getSale = store.getSale.bind(store);
    store.saveReceipt = adapter.saveReceipt.bind(adapter);
    store.getReceipt = adapter.getReceipt.bind(adapter);
    const tender = await cash(store);
    if (!tender.ok) throw new Error("cash failed");
    const result = await finalizeSale({
      store,
      salesPort: {
        confirmPayment: async (request, ctx) => ({
          ok: true as const,
          correlationId: ctx.correlationId,
          data: { transactionId: request.transactionId, status: "completed" as const },
        }),
      },
      receiptSettings: createMemoryReceiptSettingsStore(),
      actor: ACTOR,
      request: { transactionId: TX, paymentId: tender.data.paymentId },
      context: context("44444444-3333-4333-8333-333333333333"),
      now: NOW,
    });
    expect(result).toMatchObject({ ok: true, data: { status: "requires_attention" } });
    expect(await store.getReceipt(TX)).toBeUndefined();
  });
});
