import { describe, expect, test } from "vitest";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import { createInMemoryReturnStore } from "../../core/returns/in-memory-store";
import type { StoredPayment } from "../../core/checkout/types";
import type { StoredReturnRecord } from "../../core/returns/types";
import { refundTender } from "./refund";
import { resolveElectronicPayment, resolveStoredElectronic } from "./resolve-electronic";
import { beginManualMobileMoney, confirmManualMobileMoney } from "./manual-mobile-money";

const NOW = new Date("2026-10-10T12:00:00.000Z");
const TX = "11111111-1111-4111-8111-111111111111";
const TX2 = "22222222-2222-4222-8222-222222222222";
const ACTOR = { actorId: "cashier_a", displayName: "Ada", organizationId: "org_a", locationIds: ["loc_a"] };
const ENV = {
  MANUAL_MOBILE_MONEY_ENABLED: "true",
  MANUAL_MOBILE_MONEY_NETWORK: "MTN",
  MANUAL_MOBILE_MONEY_ACCOUNT_LABEL: "Shop till",
};
const ghs = (minor: number) => ({ minor, currency: "GHS" as const });

async function sale(store: ReturnType<typeof createInMemoryCheckoutStore>, transactionId: string, expiresAt = "2026-10-10T13:00:00.000Z") {
  await store.seedPreparedSale({
    organizationId: "org_a",
    locationId: "loc_a",
    locationName: "Store",
    registerId: "reg_a",
    registerName: "Register A",
    deviceId: "44444444-4444-4444-8444-444444444444",
    shiftId: "66666666-6666-4666-8666-666666666666",
    cashierId: ACTOR.actorId,
    cashierName: "Ada",
    customer: { kind: "walkin" },
    customerLabel: "Walk-in",
    prepared: {
      transactionId,
      saleId: `sale-${transactionId}`,
      orderReference: "1001",
      quoteFingerprint: "0123456789abcdef0123456789abcdef",
      total: ghs(2900),
      status: "prepared",
      stockCommitment: "reserved",
      preparedAt: "2026-10-10T11:00:00.000Z",
      expiresAt,
    },
    subtotal: ghs(2900),
    discount: ghs(0),
    tax: ghs(0),
    lines: [],
  });
}

function ids(prefix: string) {
  return {
    correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    idempotencyKey: prefix,
  } as const;
}

describe("manual Mobile Money", () => {
  test("confirms the sale total from the merchant receipt and does not move cash", async () => {
    const store = createInMemoryCheckoutStore();
    await sale(store, TX);
    const begun = await beginManualMobileMoney({
      store, actor: ACTOR, transactionId: TX, now: NOW, env: ENV, staffActive: true,
      ...ids("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    });
    expect(begun.ok).toBe(true);
    if (!begun.ok) return;
    expect(begun.data.amountMinor).toBe(2900);
    expect(begun.data.currency).toBe("GHS");
    expect(begun.data.network).toBe("MTN");
    const confirmed = await confirmManualMobileMoney({
      store, actor: ACTOR, transactionId: TX, paymentId: begun.data.payment.paymentId,
      merchantReference: "MM-1001", merchantConfirmed: true, now: NOW, env: ENV, staffActive: true,
      correlationId: ids("cccccccc-cccc-4ccc-8ccc-cccccccccccc").correlationId,
      idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.data.payment.status).toBe("verified");
    expect(confirmed.data.payment.amount).toEqual(ghs(2900));
    expect(confirmed.data.payment.displayReference).toBe("MM-1001");
    const stored = await store.getPayment(begun.data.payment.paymentId);
    expect(stored?.verificationSource).toBe("approved_external_attestation");
    expect(stored?.provider).toBe("manual_mobile_money");
    expect(stored?.cashReceived).toBeUndefined();
    expect(await store.listCashSales(TX)).toEqual([]);
    const again = await confirmManualMobileMoney({
      store, actor: ACTOR, transactionId: TX, paymentId: begun.data.payment.paymentId,
      merchantReference: "MM-1001", merchantConfirmed: true, now: new Date("2026-10-10T12:05:00.000Z"),
      env: ENV, staffActive: true,
      correlationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.data.payment.paymentId).toBe(begun.data.payment.paymentId);
    expect((await store.getPayment(begun.data.payment.paymentId))?.verifiedAt).toBe(stored?.verifiedAt);
  });

  test("replays a lost confirmation and rejects a reused reference, a second tender, and missing evidence", async () => {
    const store = createInMemoryCheckoutStore();
    await sale(store, TX);
    await sale(store, TX2);
    const begun = await beginManualMobileMoney({
      store, actor: ACTOR, transactionId: TX, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    if (!begun.ok) throw new Error("begin");
    const key = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const first = await confirmManualMobileMoney({
      store, actor: ACTOR, transactionId: TX, paymentId: begun.data.payment.paymentId,
      merchantReference: "MM-1001", merchantConfirmed: true, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab", idempotencyKey: key,
    });
    const replay = await confirmManualMobileMoney({
      store, actor: ACTOR, transactionId: TX, paymentId: begun.data.payment.paymentId,
      merchantReference: "MM-1001", merchantConfirmed: true, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac", idempotencyKey: key,
    });
    expect(first.ok && replay.ok && replay.data.payment.paymentId === first.data.payment.paymentId).toBe(true);

    const second = await beginManualMobileMoney({
      store, actor: ACTOR, transactionId: TX2, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad",
      idempotencyKey: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    });
    if (!second.ok) throw new Error("second begin");
    const reused = await confirmManualMobileMoney({
      store, actor: ACTOR, transactionId: TX2, paymentId: second.data.payment.paymentId,
      merchantReference: "MM-1001", merchantConfirmed: true, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaae",
      idempotencyKey: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    });
    expect(reused.ok).toBe(false);
    if (!reused.ok) expect(reused.error.message).toContain("already used");

    const unverified = await confirmManualMobileMoney({
      store, actor: ACTOR, transactionId: TX2, paymentId: second.data.payment.paymentId,
      merchantReference: "MM-2002", merchantConfirmed: false, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaf",
      idempotencyKey: "12121212-1212-4212-8212-121212121212",
    });
    expect(unverified.ok).toBe(false);
    if (!unverified.ok) expect(unverified.error.message).toContain("merchant receipt");
  });

  test("refuses cash, pending Paystack, disabled staff, the wrong organisation, and an expired reservation", async () => {
    const store = createInMemoryCheckoutStore();
    await sale(store, TX);
    const cash: StoredPayment = {
      paymentId: "13131313-1313-4313-8313-131313131313",
      transactionId: TX,
      saleId: `sale-${TX}`,
      tender: "cash",
      status: "verified",
      amount: ghs(2900),
      cashReceived: ghs(3000),
      actorId: ACTOR.actorId,
      verifiedAt: NOW.toISOString(),
      verificationSource: "cash_ledger",
    };
    await store.savePayment(cash);
    const blocked = await beginManualMobileMoney({
      store, actor: ACTOR, transactionId: TX, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotencyKey: "14141414-1414-4414-8414-141414141414",
    });
    expect(blocked.ok).toBe(false);

    const paystackStore = createInMemoryCheckoutStore();
    await sale(paystackStore, TX);
    await paystackStore.savePayment({
      paymentId: "15151515-1515-4515-8515-151515151515",
      transactionId: TX,
      saleId: `sale-${TX}`,
      tender: "card",
      status: "awaiting_customer",
      amount: ghs(2900),
      actorId: ACTOR.actorId,
      provider: "paystack",
      providerReference: "ps_ref",
    });
    const pending = await beginManualMobileMoney({
      store: paystackStore, actor: ACTOR, transactionId: TX, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotencyKey: "16161616-1616-4616-8616-161616161616",
    });
    expect(pending.ok).toBe(false);
    expect((await paystackStore.getPayment("15151515-1515-4515-8515-151515151515"))?.provider).toBe("paystack");

    const disabled = await beginManualMobileMoney({
      store: paystackStore, actor: ACTOR, transactionId: TX, now: NOW, env: ENV, staffActive: false,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotencyKey: "17171717-1717-4717-8717-171717171717",
    });
    expect(disabled.ok).toBe(false);

    const outsider = await beginManualMobileMoney({
      store: paystackStore, actor: { ...ACTOR, organizationId: "org_b" },
      transactionId: TX, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotencyKey: "18181818-1818-4818-8818-181818181818",
    });
    expect(outsider.ok).toBe(false);

    const expiredStore = createInMemoryCheckoutStore();
    await sale(expiredStore, TX, "2026-10-10T11:00:00.000Z");
    const expired = await beginManualMobileMoney({
      store: expiredStore, actor: ACTOR, transactionId: TX, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotencyKey: "19191919-1919-4919-8919-191919191919",
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error.code).toBe("QUOTE_EXPIRED");
  });

  test("resolve and refund never call Paystack for a manual confirmation", async () => {
    const store = createInMemoryCheckoutStore();
    await sale(store, TX);
    const begun = await beginManualMobileMoney({
      store, actor: ACTOR, transactionId: TX, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotencyKey: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    if (!begun.ok) throw new Error("begin");
    await confirmManualMobileMoney({
      store, actor: ACTOR, transactionId: TX, paymentId: begun.data.payment.paymentId,
      merchantReference: "MM-1001", merchantConfirmed: true, now: NOW, env: ENV, staffActive: true,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
      idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    let verified = false;
    const provider = {
      id: "paystack",
      initialize: async () => { throw new Error("no initialize"); },
      verify: async () => { verified = true; throw new Error("paystack verify"); },
      authenticateWebhook: () => false,
      parseWebhook: () => null,
    };
    const payment = await store.getPayment(begun.data.payment.paymentId);
    if (!payment) throw new Error("missing");
    const resolved = await resolveElectronicPayment({
      store, provider, actor: ACTOR, now: NOW,
      request: { transactionId: TX, paymentId: payment.paymentId },
      context: { correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac" },
    });
    expect(resolved.ok).toBe(true);
    expect(verified).toBe(false);
    const stored = await resolveStoredElectronic({ store, provider, payment, now: NOW });
    expect(stored.provider).toBe("manual_mobile_money");
    expect(verified).toBe(false);

    const returns = createInMemoryReturnStore();
    const record: StoredReturnRecord = {
      returnId: "33333333-3333-4333-8333-333333333333",
      organizationId: "org_a",
      locationId: "loc_a",
      registerId: "reg_a",
      actorId: ACTOR.actorId,
      transactionId: TX,
      saleId: `sale-${TX}`,
      economicsVersion: "hv1",
      fingerprint: "0123456789abcdef0123456789abcdef",
      previewExpiresAt: "2026-10-10T13:00:00.000Z",
      approvalRequired: false,
      refundTotal: ghs(2900),
      status: "previewed",
      historicLines: [],
      historicTenders: [{
        paymentId: payment.paymentId,
        tender: "mobile_money",
        originalAmount: ghs(2900),
        alreadyRefundedAmount: ghs(0),
        remainingRefundableAmount: ghs(2900),
      }],
      requestedLines: [],
    };
    await returns.insertPreview(record);
    let refunded = false;
    const refund = await refundTender({
      checkoutStore: store,
      returnStore: returns,
      provider: {
        id: "paystack",
        createRefund: async () => { refunded = true; throw new Error("paystack refund"); },
        resolveRefund: async () => { refunded = true; throw new Error("paystack refund"); },
      },
      actor: ACTOR,
      now: NOW,
      context: {
        correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaad",
        idempotencyKey: "21212121-2121-4121-8121-212121212121",
      },
      request: {
        refundId: "32323232-3232-4323-8323-323232323232",
        returnId: record.returnId,
        paymentId: payment.paymentId,
        transactionId: TX,
        channel: "provider_electronic",
        amount: ghs(2900),
      },
    });
    expect(refund.ok).toBe(false);
    if (!refund.ok) expect(refund.error.code).toBe("REQUIRES_ATTENTION");
    expect(refunded).toBe(false);
    expect(await store.listCashSales(TX)).toEqual([]);
  });
});
