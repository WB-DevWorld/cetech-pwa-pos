import { describe, expect, test } from "vitest";
import { handleInitializePayment } from "../../../apps/pos-web/src/server/payments/handle-initialize-payment";
import {
  commandBase,
  createPay01Runtime,
  INIT_KEY,
  SANDBOX_EMAIL,
  TX_A,
} from "../payments/helpers";

const UNKNOWN_TX = "99999999-9999-4999-8999-999999999991";

describe("R10 fail-closed payment guards", () => {
  test("missing prepared sale cannot reach payment-provider initialize", async () => {
    const runtime = await createPay01Runtime();

    const result = await handleInitializePayment({
      ...commandBase(runtime.sessions.cookieHeader),
      idempotencyKeyHeader: INIT_KEY,
      body: { transactionId: UNKNOWN_TX, tender: "card" },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      provider: runtime.provider,
      appEnv: "local",
      sandboxPayerEmail: SANDBOX_EMAIL,
      env: {},
    });

    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("NOT_FOUND");
    }
    expect(runtime.provider.initializeCount).toBe(0);
  });

  test("unavailable staff-assignment authority blocks before provider initialize", async () => {
    const runtime = await createPay01Runtime();

    const result = await handleInitializePayment({
      ...commandBase(runtime.sessions.cookieHeader),
      assignments: {
        async lookup() {
          return "unavailable" as const;
        },
      },
      idempotencyKeyHeader: INIT_KEY,
      body: { transactionId: TX_A, tender: "card" },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      provider: runtime.provider,
      appEnv: "local",
      sandboxPayerEmail: SANDBOX_EMAIL,
      env: {},
    });

    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("INTEGRATION_UNAVAILABLE");
    }
    expect(runtime.provider.initializeCount).toBe(0);
  });

  test("unconfigured card method blocks before provider initialize", async () => {
    const runtime = await createPay01Runtime();

    const result = await handleInitializePayment({
      ...commandBase(runtime.sessions.cookieHeader),
      idempotencyKeyHeader: INIT_KEY,
      body: { transactionId: TX_A, tender: "card" },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      provider: runtime.provider,
      appEnv: "local",
      sandboxPayerEmail: SANDBOX_EMAIL,
      env: {
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "sk_test_fixture_key",
      },
    });

    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("INTEGRATION_UNAVAILABLE");
    }
    expect(runtime.provider.initializeCount).toBe(0);
  });

  test("missing CSRF protection blocks before provider initialize", async () => {
    const runtime = await createPay01Runtime();

    const result = await handleInitializePayment({
      ...commandBase(runtime.sessions.cookieHeader),
      csrfHeader: null,
      idempotencyKeyHeader: INIT_KEY,
      body: { transactionId: TX_A, tender: "card" },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      provider: runtime.provider,
      appEnv: "local",
      sandboxPayerEmail: SANDBOX_EMAIL,
      env: {},
    });

    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("FORBIDDEN");
    }
    expect(runtime.provider.initializeCount).toBe(0);
  });
});
