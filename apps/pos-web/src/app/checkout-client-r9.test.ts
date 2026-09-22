import { describe, expect, test } from "vitest";
import type { TenderActivityPort } from "../local";
import { assessUpdateActivation } from "../local/pwa-lifecycle";
import { createBrowserCashCheckoutPorts, LOCAL_CHECKOUT_SCOPE } from "./checkout-client";

const TX = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";
const CORR = "33333333-3333-4333-8333-333333333333";

function prepared() {
  return {
    transactionId: TX,
    saleId: "sale-1",
    orderReference: "ORDER-1",
    quoteFingerprint: "0123456789abcdef0123456789abcdef",
    total: { minor: 1000, currency: "GHS" as const },
    status: "prepared" as const,
    stockCommitment: "reserved" as const,
    preparedAt: "2026-09-19T12:00:00.000Z",
    expiresAt: "2026-09-19T12:15:00.000Z",
  };
}

describe("R9 tender activity on current checkout composition", () => {
  test("prepare and electronic initialize block updates; terminal cancel clears the marker", async () => {
    let active = false;
    const events: string[] = [];
    const tenderActivity: TenderActivityPort = {
      async markActive(transactionId) {
        active = true;
        events.push(`active:${transactionId}`);
      },
      async clear(transactionId) {
        active = false;
        events.push(`clear:${transactionId}`);
      },
    };
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      events.push(`fetch:${url}`);
      const data = url.endsWith("/sales/prepare")
        ? prepared()
        : url.endsWith("/payments/initialize")
          ? {
              transactionId: TX,
              status: "pending",
              paymentId: KEY,
              tender: "mobile_money",
              amount: { minor: 1000, currency: "GHS" },
              nextAction: "wait",
            }
          : { transactionId: TX, status: "cancelled" };
      return new Response(JSON.stringify({ ok: true, correlationId: CORR, data }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const ports = createBrowserCashCheckoutPorts({
      fetchImpl,
      scope: LOCAL_CHECKOUT_SCOPE,
      tenderActivity,
    });

    await ports.checkout.prepare(
      {
        transactionId: TX,
        registerId: LOCAL_CHECKOUT_SCOPE.registerId,
        shiftId: LOCAL_CHECKOUT_SCOPE.shiftId,
        deviceId: LOCAL_CHECKOUT_SCOPE.deviceId,
        quoteId: "quote-1",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
      },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    expect(active).toBe(true);
    expect(events.indexOf(`active:${TX}`)).toBeLessThan(
      events.indexOf("fetch:/api/pos/v1/sales/prepare"),
    );
    expect(assessUpdateActivation({
      activeTender: active,
      criticalOperationCount: 0,
      syncMutationInProgress: false,
      localMigrationInProgress: false,
      activeWindow: true,
      appBuild: "1.0.0",
    })).toEqual({ safe: false, reasons: ["ACTIVE_TENDER"] });

    await ports.payments.initialize?.(
      { transactionId: TX, tender: "mobile_money" },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    expect(active).toBe(true);

    await ports.sales.cancel(
      { transactionId: TX, reason: "cashier_cancelled_prepared_sale" },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    expect(active).toBe(false);
    expect(events.at(-1)).toBe(`clear:${TX}`);
  });

  test("cash/finalize keeps the marker until the sale is terminal", async () => {
    let active = false;
    const tenderActivity: TenderActivityPort = {
      async markActive() { active = true; },
      async clear() { active = false; },
    };
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      const data = url.endsWith("/sales/prepare")
        ? prepared()
        : url.endsWith("/sales/finalize")
          ? { transactionId: TX, status: "completed", saleId: "sale-1", receiptId: "receipt-1" }
          : {
              transactionId: TX,
              status: "verified",
              paymentId: KEY,
              tender: "cash",
              amount: { minor: 1000, currency: "GHS" },
              verifiedAt: "2026-09-19T12:01:00.000Z",
              nextAction: "none",
            };
      return new Response(JSON.stringify({ ok: true, correlationId: CORR, data }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const ports = createBrowserCashCheckoutPorts({ fetchImpl, scope: LOCAL_CHECKOUT_SCOPE, tenderActivity });
    await ports.checkout.prepare(
      {
        transactionId: TX,
        registerId: LOCAL_CHECKOUT_SCOPE.registerId,
        shiftId: LOCAL_CHECKOUT_SCOPE.shiftId,
        deviceId: LOCAL_CHECKOUT_SCOPE.deviceId,
        quoteId: "quote-1",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
      },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    await ports.payments.confirmCash(
      { transactionId: TX, cashReceived: { minor: 1000, currency: "GHS" } },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    expect(active).toBe(true);
    await ports.checkout.finalize(
      { transactionId: TX, paymentId: KEY },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    expect(active).toBe(false);
  });
});
