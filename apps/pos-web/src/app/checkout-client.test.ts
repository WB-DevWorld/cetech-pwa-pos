import { describe, expect, test } from "vitest";
import { createBrowserCashCheckoutPorts } from "./checkout-client";
import { fetchRegisterClosePresentation } from "./operational-client";

const LOCAL_CHECKOUT_SCOPE = {
  registerId: "reg-test",
  shiftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  deviceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
} as const;

const TX = "11111111-1111-4111-8111-111111111111";
const KEY = "22222222-2222-4222-8222-222222222222";
const CORR = "33333333-3333-4333-8333-333333333333";

describe("operational GET request contract", () => {
  test("register close availability sends a valid correlation id and credentials", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          ok: true,
          correlationId: CORR,
          data: { showClose: true, notice: "You can close this shift under the current policy." },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const result = await fetchRegisterClosePresentation("reg a/1", fetchImpl);

    expect(result.ok).toBe(true);
    expect(capturedUrl).toBe("/api/pos/v1/registers/reg%20a%2F1/close-presentation");
    expect(capturedInit?.method).toBe("GET");
    expect(capturedInit?.credentials).toBe("include");
    const headers = new Headers(capturedInit?.headers);
    expect(headers.get("x-correlation-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

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
