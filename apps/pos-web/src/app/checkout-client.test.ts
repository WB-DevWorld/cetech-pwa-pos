import { describe, expect, test } from "vitest";
import type { TenderActivityPort } from "../local";
import { createBrowserCashCheckoutPorts, LOCAL_CHECKOUT_SCOPE } from "./checkout-client";

const TX = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";
const CORR = "33333333-3333-4333-8333-333333333333";

describe("CORE-06 browser checkout client", () => {
  test("prepare, cash, finalize, resolve and receipt call BFF routes with idempotency and correlation headers", async () => {
    const calls: Array<{ url: string; method: string; headers: Headers; body: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({
        url,
        method: init?.method ?? "GET",
        headers: new Headers(init?.headers),
        body: typeof init?.body === "string" ? init.body : null,
      });
      return new Response(
        JSON.stringify({
          ok: true,
          correlationId: CORR,
          data: { transactionId: TX, status: "prepared" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const ports = createBrowserCashCheckoutPorts({ fetchImpl, scope: LOCAL_CHECKOUT_SCOPE });
    await ports.checkout.prepare(
      {
        transactionId: TX,
        registerId: LOCAL_CHECKOUT_SCOPE.registerId,
        shiftId: LOCAL_CHECKOUT_SCOPE.shiftId,
        deviceId: LOCAL_CHECKOUT_SCOPE.deviceId,
        quoteId: "quote-retail-1",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
      },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    await ports.payments.confirmCash(
      { transactionId: TX, cashReceived: { minor: 2000, currency: "GHS" } },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    await ports.checkout.finalize(
      { transactionId: TX, paymentId: KEY },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    await ports.sales.resolve(TX);
    await ports.receipts.getByTransaction(TX);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "POST /api/pos/v1/sales/prepare",
      "POST /api/pos/v1/payments/cash",
      "POST /api/pos/v1/sales/finalize",
      `GET /api/pos/v1/sales/${TX}`,
      `GET /api/pos/v1/receipts/${TX}`,
    ]);
    expect(calls[0]?.headers.get("idempotency-key")).toBe(KEY);
    expect(calls[0]?.headers.get("x-correlation-id")).toBe(CORR);
    expect(calls[3]?.headers.get("idempotency-key")).toBeNull();
  });

  test("successful prepare marks tender active before any payment command and terminal finalize clears it", async () => {
    const events: string[] = [];
    const tenderActivity: TenderActivityPort = {
      async markActive(transactionId) {
        events.push(`active:${transactionId}`);
      },
      async clear(transactionId) {
        events.push(`clear:${transactionId}`);
      },
    };
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      events.push(`fetch:${url}`);
      const data = url.endsWith("/sales/prepare")
        ? {
            transactionId: TX,
            saleId: "sale-1",
            orderReference: "ORDER-1",
            quoteFingerprint: "0123456789abcdef0123456789abcdef",
            total: { minor: 1000, currency: "GHS" },
            status: "prepared",
            stockCommitment: "reserved",
            preparedAt: "2026-09-16T12:00:00.000Z",
            expiresAt: "2026-09-16T12:15:00.000Z",
          }
        : url.endsWith("/sales/finalize")
          ? { transactionId: TX, status: "completed", saleId: "sale-1", receiptId: "receipt-1" }
          : { transactionId: TX, status: "verified", paymentId: KEY, tender: "cash", amount: { minor: 1000, currency: "GHS" }, verifiedAt: "2026-09-16T12:01:00.000Z", nextAction: "none" };
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
        quoteId: "quote-retail-1",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
      },
      { idempotencyKey: KEY, correlationId: CORR },
    );

    expect(events).toEqual(["fetch:/api/pos/v1/sales/prepare", `active:${TX}`]);

    await ports.payments.confirmCash(
      { transactionId: TX, cashReceived: { minor: 1000, currency: "GHS" } },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    await ports.checkout.finalize(
      { transactionId: TX, paymentId: KEY },
      { idempotencyKey: KEY, correlationId: CORR },
    );

    expect(events).toContain(`active:${TX}`);
    expect(events.at(-1)).toBe(`clear:${TX}`);
  });
});
