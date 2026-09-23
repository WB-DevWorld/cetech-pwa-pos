import { describe, expect, test } from "vitest";
import { createBrowserCashCheckoutPorts } from "./checkout-client";

const LOCAL_CHECKOUT_SCOPE = {
  registerId: "reg-test",
  shiftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  deviceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
} as const;

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
    const initialize = ports.payments.initialize;
    expect(initialize).toEqual(expect.any(Function));
    await initialize?.(
      { transactionId: TX, tender: "mobile_money" },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    await ports.sales.cancel({ transactionId: TX, reason: "cashier_cancelled_prepared_sale" }, { idempotencyKey: KEY, correlationId: CORR });
    await ports.receipts.getByTransaction(TX);
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      "POST /api/pos/v1/sales/prepare",
      "POST /api/pos/v1/payments/cash",
      "POST /api/pos/v1/sales/finalize",
      `GET /api/pos/v1/sales/${TX}`,
      "POST /api/pos/v1/payments/initialize",
      "POST /api/pos/v1/sales/cancel",
      `GET /api/pos/v1/receipts/${TX}`,
    ]);
    expect(calls[0]?.headers.get("idempotency-key")).toBe(KEY);
    expect(calls[0]?.headers.get("x-correlation-id")).toBe(CORR);
    expect(calls[3]?.headers.get("idempotency-key")).toBeNull();
    expect(JSON.parse(calls[0]?.body ?? "{}")).toMatchObject({
      registerId: LOCAL_CHECKOUT_SCOPE.registerId,
      shiftId: LOCAL_CHECKOUT_SCOPE.shiftId,
      deviceId: LOCAL_CHECKOUT_SCOPE.deviceId,
    });
  });

  test("selected-register checkout scope is sent on prepare instead of a hardcoded fallback", async () => {
    const calls: Array<string> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(typeof init?.body === "string" ? init.body : "");
      return new Response(
        JSON.stringify({ ok: true, correlationId: CORR, data: { transactionId: TX, status: "prepared" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const scope = { registerId: "reg_b", shiftId: "shift-b", deviceId: "device-b" };
    const ports = createBrowserCashCheckoutPorts({ fetchImpl, scope });
    await ports.checkout.prepare(
      {
        transactionId: TX,
        registerId: scope.registerId,
        shiftId: scope.shiftId,
        deviceId: scope.deviceId,
        quoteId: "quote-retail-1",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
      },
      { idempotencyKey: KEY, correlationId: CORR },
    );
    expect(ports.scope).toEqual(scope);
    expect(JSON.parse(calls[0] ?? "{}")).toMatchObject({
      registerId: "reg_b",
      shiftId: "shift-b",
      deviceId: "device-b",
    });
    expect(ports.scope.registerId).not.toBe("reg-front-1");
  });
});
