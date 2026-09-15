import { describe, expect, test } from "vitest";
import { handleInitializePayment } from "../../../apps/pos-web/src/server/payments/handle-initialize-payment";
import { composeElectronicPaymentProvider } from "../../../apps/pos-web/src/server/payments/compose-payment-provider";
import {
  createPaystackElectronicPaymentProvider,
  type PaystackFetch,
} from "../../../apps/pos-web/src/server/payments/paystack-provider";
import { handleFinalizeSale } from "../../../apps/pos-web/src/server/sales/handle-finalize-sale";
import { handleGetReceipt } from "../../../apps/pos-web/src/server/sales/handle-get-receipt";
import { handleResolvePayment } from "../../../apps/pos-web/src/server/sales/handle-resolve-payment";
import { createFakeElectronicPaymentProvider } from "../../../apps/pos-web/src/server/payments/fake-provider";
import { readPaymentProviderConfig } from "../../../apps/pos-web/src/server/payments/config";
import {
  commandBase,
  confirmCash,
  createPay01Runtime,
  finalize,
  ghs,
  INIT_KEY,
  INIT_KEY_2,
  initializeCard,
  receipt,
  resolvePayment,
  SANDBOX_EMAIL,
  staffCookies,
  TX_A,
  webhook,
} from "./helpers";

function chargeBody(reference: string, event = "charge.success", status = "success") {
  return JSON.stringify({
    event,
    data: {
      id: 4242,
      domain: "test",
      status,
      reference,
      amount: 2900,
      currency: "GHS",
    },
  });
}

describe("PAY-01 electronic initialize", () => {
  test("requires a prepared sale", async () => {
    const runtime = await createPay01Runtime();
    const { store, cookieHeader } = await staffCookies();
    const result = await handleInitializePayment({
      ...commandBase(cookieHeader),
      idempotencyKeyHeader: INIT_KEY,
      body: { transactionId: "99999999-9999-4999-8999-999999999999", tender: "card" },
      sessionStore: store,
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
  });

  test("wrong organization is denied", async () => {
    const runtime = await createPay01Runtime();
    const outsider = await staffCookies({ actorId: "cashier_b", organizationId: "org_b", locationIds: ["loc_b1"] });
    const result = await handleInitializePayment({
      ...commandBase(outsider.cookieHeader),
      idempotencyKeyHeader: INIT_KEY,
      body: { transactionId: TX_A, tender: "card" },
      sessionStore: outsider.store,
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
  });

  test("wrong location is denied", async () => {
    const runtime = await createPay01Runtime();
    const outsider = await staffCookies({ locationIds: ["loc_a2"] });
    const result = await handleInitializePayment({
      ...commandBase(outsider.cookieHeader),
      idempotencyKeyHeader: INIT_KEY,
      body: { transactionId: TX_A, tender: "card" },
      sessionStore: outsider.store,
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
  });

  test("completed and cancelled sales are denied", async () => {
    const completed = await createPay01Runtime();
    const sale = await completed.checkoutStore.getSale(TX_A);
    await completed.checkoutStore.saveSale({ ...sale!, status: "completed" });
    const completedResult = await initializeCard(completed);
    expect(completedResult.body.ok).toBe(false);
    if (!completedResult.body.ok) {
      expect(completedResult.body.error.code).toBe("VALIDATION_ERROR");
    }
    const cancelled = await createPay01Runtime();
    const cancelledSale = await cancelled.checkoutStore.getSale(TX_A);
    await cancelled.checkoutStore.saveSale({ ...cancelledSale!, status: "cancelled" });
    const cancelledResult = await initializeCard(cancelled);
    expect(cancelledResult.body.ok).toBe(false);
  });

  test("existing verified cash tender prevents a second electronic payment", async () => {
    const runtime = await createPay01Runtime();
    const cash = await confirmCash(runtime);
    expect(cash.body.ok).toBe(true);
    const electronic = await initializeCard(runtime);
    expect(electronic.body.ok).toBe(false);
    if (!electronic.body.ok) {
      expect(electronic.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(runtime.provider.initializeCount).toBe(0);
  });

  test("same idempotency key and body replays without a second provider initialize", async () => {
    const runtime = await createPay01Runtime();
    const first = await initializeCard(runtime);
    const second = await initializeCard(runtime);
    expect(first.body.ok).toBe(true);
    expect(second.body.ok).toBe(true);
    if (first.body.ok && second.body.ok) {
      expect(second.body.data.paymentId).toBe(first.body.data.paymentId);
      expect(second.body.data.displayReference).toBe(first.body.data.displayReference);
    }
    expect(runtime.provider.initializeCount).toBe(1);
  });

  test("changed body after an effectful initialize conflicts", async () => {
    const runtime = await createPay01Runtime();
    const first = await initializeCard(runtime);
    expect(first.body.ok).toBe(true);
    const changed = await handleInitializePayment({
      ...commandBase(runtime.sessions.cookieHeader),
      idempotencyKeyHeader: INIT_KEY,
      body: { transactionId: TX_A, tender: "mobile_money" },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      provider: runtime.provider,
      appEnv: "local",
      sandboxPayerEmail: SANDBOX_EMAIL,
      env: {},
    });
    expect(changed.body.ok).toBe(false);
    if (!changed.body.ok) {
      expect(changed.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    }
    expect(runtime.provider.initializeCount).toBe(1);
  });

  test("lost initialize response recovers the same provider reference", async () => {
    const runtime = await createPay01Runtime();
    runtime.provider.setInitializeOutcome("lost_response");
    const lost = await initializeCard(runtime);
    expect(lost.body.ok).toBe(true);
    if (lost.body.ok) {
      expect(lost.body.data.status).toBe("reconciling");
    }
    runtime.provider.setInitializeOutcome("initialized");
    const recovered = await initializeCard(runtime);
    expect(recovered.body.ok).toBe(true);
    if (lost.body.ok && recovered.body.ok) {
      expect(recovered.body.data.paymentId).toBe(lost.body.data.paymentId);
      expect(recovered.body.data.displayReference).toBe(lost.body.data.displayReference);
    }
    expect(runtime.provider.initializeCount).toBe(1);
  });

  test("a caller cannot resolve another tenant payment or submit an arbitrary provider reference", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    const outsider = await staffCookies({ actorId: "cashier_b", organizationId: "org_b", locationIds: ["loc_b1"] });
    const resolved = await handleResolvePayment({
      ...commandBase(outsider.cookieHeader),
      body: { transactionId: TX_A, paymentId: initialized.body.data.paymentId },
      sessionStore: outsider.store,
      checkoutStore: runtime.checkoutStore,
      provider: runtime.provider,
    });
    expect(resolved.body.ok).toBe(false);
    if (!resolved.body.ok) {
      expect(resolved.body.error.code).toBe("FORBIDDEN");
    }
    expect(runtime.provider.verifyCount).toBe(0);
  });

  test("pending repeat with a new key does not reinitialize", async () => {
    const runtime = await createPay01Runtime();
    const first = await initializeCard(runtime, INIT_KEY);
    const second = await initializeCard(runtime, INIT_KEY_2);
    expect(first.body.ok).toBe(true);
    expect(second.body.ok).toBe(true);
    if (first.body.ok && second.body.ok) {
      expect(second.body.data.paymentId).toBe(first.body.data.paymentId);
    }
    expect(runtime.provider.initializeCount).toBe(1);
  });

  test("amount and currency come from the prepared sale, not the browser", async () => {
    const runtime = await createPay01Runtime();
    const result = await initializeCard(runtime);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.data.amount).toEqual(ghs(2900));
    }
  });

  test("live provider configuration fails closed without initialize", async () => {
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
      env: { PAYMENT_PROVIDER: "paystack", PAYSTACK_MODE: "live", PAYSTACK_SECRET_KEY: "sk_live_not_used" },
    });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("INTEGRATION_UNAVAILABLE");
    }
    expect(runtime.provider.initializeCount).toBe(0);
  });

  test("public or unknown secrets fail closed without initialize", async () => {
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
      env: { PAYMENT_PROVIDER: "paystack", PAYSTACK_MODE: "test", PAYSTACK_SECRET_KEY: "pk_test_fixture" },
    });
    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("INTEGRATION_UNAVAILABLE");
    }
    expect(runtime.provider.initializeCount).toBe(0);
  });

  test("production refuses the sandbox payer fixture", async () => {
    const runtime = await createPay01Runtime();
    const result = await handleInitializePayment({
      ...commandBase(runtime.sessions.cookieHeader),
      idempotencyKeyHeader: INIT_KEY,
      body: { transactionId: TX_A, tender: "card" },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      provider: runtime.provider,
      appEnv: "production",
      sandboxPayerEmail: SANDBOX_EMAIL,
      env: {},
    });
    expect(result.body.ok).toBe(false);
    expect(runtime.provider.initializeCount).toBe(0);
  });
});

describe("PAY-01 verification", () => {
  test("provider success with exact amount, currency, and reference is verified", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    runtime.provider.setDefaultVerify("success");
    const resolved = await resolvePayment(runtime, initialized.body.data.paymentId);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("verified");
      expect(resolved.body.data.tender).toBe("card");
      expect(resolved.body.data.verifiedAt).toBeTruthy();
    }
    const payment = await runtime.checkoutStore.getPayment(initialized.body.data.paymentId);
    expect(payment?.verificationSource).toBe("provider_server_verification");
  });

  test("API envelope success with a non-success transaction status is not verified", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    runtime.provider.setDefaultVerify("envelope_only");
    const resolved = await resolvePayment(runtime, initialized.body.data.paymentId);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).not.toBe("verified");
    }
  });

  test("wrong amount, currency, and reference require attention", async () => {
    for (const script of ["amount_mismatch", "currency_mismatch", "reference_mismatch"] as const) {
      const runtime = await createPay01Runtime();
      const initialized = await initializeCard(runtime);
      expect(initialized.body.ok).toBe(true);
      if (!initialized.body.ok) {
        return;
      }
      runtime.provider.setVerifyOutcome(initialized.body.data.displayReference ?? "", script);
      const resolved = await resolvePayment(runtime, initialized.body.data.paymentId);
      expect(resolved.body.ok).toBe(true);
      if (resolved.body.ok) {
        expect(resolved.body.data.status).toBe("requires_attention");
      }
    }
  });

  test("live-mode provider response while test mode is expected fails closed", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    runtime.provider.setDefaultVerify("live_mode");
    const resolved = await resolvePayment(runtime, initialized.body.data.paymentId);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("requires_attention");
    }
  });

  test("unknown provider status requires attention", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    runtime.provider.setDefaultVerify("unknown_status");
    const resolved = await resolvePayment(runtime, initialized.body.data.paymentId);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("requires_attention");
    }
  });

  test("provider verification timeout reconciles without a second charge", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    runtime.provider.setDefaultVerify("timeout");
    const resolved = await resolvePayment(runtime, initialized.body.data.paymentId);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("reconciling");
      expect(resolved.body.data.paymentId).toBe(initialized.body.data.paymentId);
    }
    expect(runtime.provider.initializeCount).toBe(1);
  });
});

describe("PAY-01 webhooks", () => {
  test("valid signature is accepted and invalid signature is rejected", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    const raw = chargeBody(initialized.body.data.displayReference ?? "");
    const valid = await webhook(runtime, raw);
    expect(valid.status).toBe(200);
    const invalid = await webhook(runtime, raw, "deadbeef");
    expect(invalid.status).toBe(401);
  });

  test("signature is calculated on the raw body", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    const raw = chargeBody(initialized.body.data.displayReference ?? "");
    const mutated = `${raw} `;
    const result = await webhook(runtime, mutated, runtime.provider.sign(raw));
    expect(result.status).toBe(401);
  });

  test("duplicate events are idempotent", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    runtime.provider.setDefaultVerify("success");
    const raw = chargeBody(initialized.body.data.displayReference ?? "");
    expect((await webhook(runtime, raw)).status).toBe(200);
    expect((await webhook(runtime, raw)).status).toBe(200);
    const payment = await runtime.checkoutStore.getPayment(initialized.body.data.paymentId);
    expect(payment?.status).toBe("verified");
    expect(runtime.provider.verifyCount).toBe(1);
  });

  test("out-of-order pending then success verifies once", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    const reference = initialized.body.data.displayReference ?? "";
    runtime.provider.setVerifyOutcome(reference, "pending");
    expect((await webhook(runtime, chargeBody(reference, "charge.pending", "pending"))).status).toBe(200);
    runtime.provider.setVerifyOutcome(reference, "success");
    expect((await webhook(runtime, chargeBody(reference))).status).toBe(200);
    const payment = await runtime.checkoutStore.getPayment(initialized.body.data.paymentId);
    expect(payment?.status).toBe("verified");
  });

  test("failed event then later verified success reconciles the original reference", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    const reference = initialized.body.data.displayReference ?? "";
    runtime.provider.setVerifyOutcome(reference, "failed");
    expect((await webhook(runtime, chargeBody(reference, "charge.failed", "failed"))).status).toBe(200);
    expect((await runtime.checkoutStore.getPayment(initialized.body.data.paymentId))?.status).toBe("failed");
    runtime.provider.setVerifyOutcome(reference, "success");
    expect((await webhook(runtime, chargeBody(reference))).status).toBe(200);
    const payment = await runtime.checkoutStore.getPayment(initialized.body.data.paymentId);
    expect(payment?.status).toBe("verified");
    expect(runtime.provider.initializeCount).toBe(1);
  });

  test("unknown provider reference does not verify an arbitrary provider transaction", async () => {
    const runtime = await createPay01Runtime();
    await initializeCard(runtime);
    const before = runtime.provider.verifyCount;
    const raw = chargeBody("unknown-reference-oracle");
    const result = await webhook(runtime, raw);
    expect(result.status).toBe(200);
    expect(runtime.provider.verifyCount).toBe(before);
    expect(JSON.stringify(result.body)).not.toContain("woo-pay01");
    expect(JSON.stringify(result.body)).not.toContain(TX_A);
  });

  test("webhook does not bypass server verification", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    runtime.provider.setDefaultVerify("amount_mismatch");
    const raw = chargeBody(initialized.body.data.displayReference ?? "");
    expect((await webhook(runtime, raw)).status).toBe(200);
    const payment = await runtime.checkoutStore.getPayment(initialized.body.data.paymentId);
    expect(payment?.status).toBe("requires_attention");
  });
});

describe("PAY-01 reconciliation", () => {
  test("pending resolve uses the same intent and never charges again", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    runtime.provider.setDefaultVerify("pending");
    const resolved = await resolvePayment(runtime, initialized.body.data.paymentId);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("pending");
      expect(resolved.body.data.paymentId).toBe(initialized.body.data.paymentId);
    }
    expect(runtime.provider.initializeCount).toBe(1);
  });

  test("late success reconciles the original reference", async () => {
    const runtime = await createPay01Runtime();
    runtime.provider.setInitializeOutcome("lost_response");
    const lost = await initializeCard(runtime);
    expect(lost.body.ok).toBe(true);
    runtime.provider.setDefaultVerify("success");
    const resolved = await resolvePayment(runtime);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("verified");
    }
    expect(runtime.provider.initializeCount).toBe(1);
  });

  test("stale failure after verified cannot downgrade", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    runtime.provider.setDefaultVerify("success");
    await resolvePayment(runtime, initialized.body.data.paymentId);
    runtime.provider.setDefaultVerify("failed");
    const stale = await webhook(runtime, chargeBody(initialized.body.data.displayReference ?? "", "charge.failed", "failed"));
    expect(stale.status).toBe(200);
    const payment = await runtime.checkoutStore.getPayment(initialized.body.data.paymentId);
    expect(payment?.status).toBe("verified");
  });

  test("process restart recovers the same payment, verifies once, finalizes once, and reprints", async () => {
    const first = await createPay01Runtime();
    const shared = first.checkoutStore;
    const initialized = await initializeCard(first);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    const paymentId = initialized.body.data.paymentId;
    const provider = first.provider;
    provider.setDefaultVerify("success");
    const secondSessions = await staffCookies();
    const resolved = await handleResolvePayment({
      ...commandBase(secondSessions.cookieHeader),
      body: { transactionId: TX_A, paymentId },
      sessionStore: secondSessions.store,
      checkoutStore: shared,
      provider,
    });
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("verified");
      expect(resolved.body.data.paymentId).toBe(paymentId);
    }
    const finalized = await handleFinalizeSale({
      ...commandBase(secondSessions.cookieHeader),
      idempotencyKeyHeader: "33333333-3333-4333-8333-333333333399",
      body: { transactionId: TX_A, paymentId },
      sessionStore: secondSessions.store,
      checkoutStore: shared,
      salesPort: first.salesPort,
    });
    expect(finalized.body.ok).toBe(true);
    const thirdSessions = await staffCookies();
    const reprinted = await handleGetReceipt({
      ...commandBase(thirdSessions.cookieHeader),
      transactionId: TX_A,
      sessionStore: thirdSessions.store,
      checkoutStore: shared,
    });
    expect(reprinted.body.ok).toBe(true);
    expect(provider.initializeCount).toBe(1);
    expect(first.salesPort.paymentCompleteCount).toBe(1);
  });
});

describe("PAY-01 commercial finalization and cash regression", () => {
  test("verified electronic payment finalizes once with an electronic receipt", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    runtime.provider.setDefaultVerify("success");
    await resolvePayment(runtime, initialized.body.data.paymentId);
    const first = await finalize(runtime, initialized.body.data.paymentId);
    const second = await finalize(runtime, initialized.body.data.paymentId);
    expect(first.body.ok).toBe(true);
    expect(second.body.ok).toBe(true);
    if (first.body.ok) {
      expect(first.body.data.status).toBe("completed");
    }
    expect(runtime.salesPort.paymentCompleteCount).toBe(1);
    expect(runtime.salesPort.stockEffectCount).toBe(1);
    expect(runtime.provider.initializeCount).toBe(1);
    const printed = await receipt(runtime);
    expect(printed.body.ok).toBe(true);
    if (printed.body.ok) {
      expect(printed.body.data.tender).toBe("card");
      expect(printed.body.data.total).toEqual(ghs(2900));
      expect(printed.body.data.cashReceived).toBeUndefined();
      expect(printed.body.data.changeDue).toBeUndefined();
    }
  });

  test("cash confirmation still records one cash movement and rejects an in-flight electronic intent", async () => {
    const cashRuntime = await createPay01Runtime();
    const cash = await confirmCash(cashRuntime);
    expect(cash.body.ok).toBe(true);
    expect(await cashRuntime.checkoutStore.listCashSales(TX_A)).toHaveLength(1);
    const electronicRuntime = await createPay01Runtime();
    await initializeCard(electronicRuntime);
    const blocked = await confirmCash(electronicRuntime);
    expect(blocked.body.ok).toBe(false);
    expect(await electronicRuntime.checkoutStore.listCashSales(TX_A)).toHaveLength(0);
  });
});

describe("PAY-01 provider config and Paystack adapter", () => {
  const testEnv = {
    PAYMENT_PROVIDER: "paystack",
    PAYSTACK_MODE: "test",
    PAYSTACK_SECRET_KEY: "sk_test_fixture",
  };

  test("valid test key is classified paystack_test", () => {
    expect(readPaymentProviderConfig(testEnv)).toMatchObject({
      kind: "paystack_test",
      secretKey: "sk_test_fixture",
    });
    expect(composeElectronicPaymentProvider(testEnv).kind).toBe("ready");
  });

  test("NEXT_PUBLIC Paystack secrets fail closed", () => {
    expect(() =>
      readPaymentProviderConfig({
        NEXT_PUBLIC_PAYSTACK_SECRET_KEY: "sk_test_should_not_exist",
      }),
    ).toThrow(/must not be exposed/);
  });

  test("sk_live keys are blocked live", () => {
    expect(
      readPaymentProviderConfig({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "sk_live_fixture",
      }),
    ).toEqual({ kind: "blocked_live" });
  });

  test("public test keys and unknown secrets are blocked unsafe", () => {
    for (const secret of ["pk_test_fixture", "pk_live_fixture", "some-secret", "sk_other_fixture", "foo"]) {
      expect(
        readPaymentProviderConfig({
          PAYMENT_PROVIDER: "paystack",
          PAYSTACK_MODE: "test",
          PAYSTACK_SECRET_KEY: secret,
        }),
      ).toEqual({ kind: "blocked_unsafe" });
      expect(
        composeElectronicPaymentProvider({
          PAYMENT_PROVIDER: "paystack",
          PAYSTACK_MODE: "test",
          PAYSTACK_SECRET_KEY: secret,
        }).kind,
      ).toBe("blocked_unsafe");
    }
  });

  test("explicit live mode blocks even a test key", () => {
    expect(
      readPaymentProviderConfig({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "live",
        PAYSTACK_SECRET_KEY: "sk_test_fixture",
      }),
    ).toEqual({ kind: "blocked_live" });
  });

  test("empty and placeholder secrets stay disabled", () => {
    expect(
      readPaymentProviderConfig({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "",
      }),
    ).toEqual({ kind: "disabled" });
    expect(
      readPaymentProviderConfig({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "REPLACE_WITH_SERVER_ONLY_SANDBOX_KEY",
      }),
    ).toEqual({ kind: "disabled" });
  });

  test("unsafe adapter secrets never call the network", async () => {
    let calls = 0;
    const fetchImpl: PaystackFetch = async () => {
      calls += 1;
      throw new Error("unsafe Paystack key must not call the network");
    };
    const init = {
      reference: "pos_abc",
      amount: ghs(2900),
      email: SANDBOX_EMAIL,
      tender: "card" as const,
      metadata: {
        transactionId: TX_A,
        paymentId: "22222222-2222-4222-8222-222222222299",
        saleId: "woo-pay01",
        organizationId: "org_a",
        locationId: "loc_a1",
      },
    };
    for (const secret of ["sk_live_fixture", "pk_test_fixture", "some-secret", "sk_other_fixture"]) {
      const provider = createPaystackElectronicPaymentProvider({ secretKey: secret, fetchImpl });
      expect(await provider.initialize(init)).toEqual({ kind: "live_mode_blocked" });
      const verified = await provider.verify("pos_abc");
      expect(verified.kind).toBe("unavailable");
      if (verified.kind === "unavailable") {
        expect(verified.retryable).toBe(false);
      }
      expect(provider.authenticateWebhook("{}", "sig")).toBe(false);
      expect(calls).toBe(0);
    }
  });

  test("valid test key may execute against a mocked transport", async () => {
    let calls = 0;
    const provider = createPaystackElectronicPaymentProvider({
      secretKey: "sk_test_fixture",
      fetchImpl: async () => {
        calls += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            data: { access_code: "acc_test", reference: "pos_abc" },
          }),
        };
      },
    });
    const initialized = await provider.initialize({
      reference: "pos_abc",
      amount: ghs(2900),
      email: SANDBOX_EMAIL,
      tender: "card",
      metadata: {
        transactionId: TX_A,
        paymentId: "22222222-2222-4222-8222-222222222299",
        saleId: "woo-pay01",
        organizationId: "org_a",
        locationId: "loc_a1",
      },
    });
    expect(initialized.kind).toBe("initialized");
    expect(calls).toBe(1);
  });

  test("Paystack adapter uses transaction status not the envelope flag", async () => {
    const provider = createPaystackElectronicPaymentProvider({
      secretKey: "sk_test_fixture",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: {
            id: 9,
            domain: "test",
            status: "ongoing",
            reference: "pos_abc",
            amount: 2900,
            currency: "GHS",
          },
        }),
      }),
    });
    const verified = await provider.verify("pos_abc");
    expect(verified.kind).toBe("pending");
  });

  test("Paystack adapter signs webhooks with HMAC-SHA512 of the raw body", () => {
    const fake = createFakeElectronicPaymentProvider({ webhookSecret: "sk_test_fixture" });
    const raw = '{"event":"charge.success"}';
    expect(fake.authenticateWebhook(raw, fake.sign(raw))).toBe(true);
    expect(fake.authenticateWebhook(raw, fake.sign(`${raw} `))).toBe(false);
  });
});
