import { describe, expect, test } from "vitest";
import { handleFinalizeSale } from "../../../apps/pos-web/src/server/sales/handle-finalize-sale";
import {
  cashierAssignments,
  commandBase,
  confirmCash,
  createPay01Runtime,
  FINALIZE_KEY,
  TX_A,
} from "../payments/helpers";

describe("R10 fail-closed sale finalization guards", () => {
  test("wrong register assignment is denied before commercial finalization or stock effect", async () => {
    const runtime = await createPay01Runtime();
    const cash = await confirmCash(runtime);
    expect(cash.body.ok).toBe(true);
    if (!cash.body.ok) {
      return;
    }

    const finalized = await handleFinalizeSale({
      ...commandBase(runtime.sessions.cookieHeader),
      assignments: cashierAssignments(["reg_other"]),
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_A, paymentId: cash.body.data.paymentId },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      salesPort: runtime.salesPort,
    });

    expect(finalized.body.ok).toBe(false);
    if (!finalized.body.ok) {
      expect(finalized.body.error.code).toBe("FORBIDDEN");
    }
    expect(runtime.salesPort.paymentCompleteCount).toBe(0);
    expect(runtime.salesPort.stockEffectCount).toBe(0);
  });

  test("missing CSRF protection is denied before commercial finalization or stock effect", async () => {
    const runtime = await createPay01Runtime();
    const cash = await confirmCash(runtime);
    expect(cash.body.ok).toBe(true);
    if (!cash.body.ok) {
      return;
    }

    const finalized = await handleFinalizeSale({
      ...commandBase(runtime.sessions.cookieHeader),
      csrfHeader: null,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_A, paymentId: cash.body.data.paymentId },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      salesPort: runtime.salesPort,
    });

    expect(finalized.body.ok).toBe(false);
    if (!finalized.body.ok) {
      expect(finalized.body.error.code).toBe("FORBIDDEN");
    }
    expect(runtime.salesPort.paymentCompleteCount).toBe(0);
    expect(runtime.salesPort.stockEffectCount).toBe(0);
  });

  test("missing verified payment evidence cannot reach commercial finalization or stock effect", async () => {
    const runtime = await createPay01Runtime();

    const finalized = await handleFinalizeSale({
      ...commandBase(runtime.sessions.cookieHeader),
      idempotencyKeyHeader: FINALIZE_KEY,
      body: {
        transactionId: TX_A,
        paymentId: "99999999-9999-4999-8999-999999999882",
      },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      salesPort: runtime.salesPort,
    });

    expect(finalized.body.ok).toBe(false);
    if (!finalized.body.ok) {
      expect(finalized.body.error.code).toBe("PAYMENT_NOT_VERIFIED");
    }
    expect(runtime.salesPort.paymentCompleteCount).toBe(0);
    expect(runtime.salesPort.stockEffectCount).toBe(0);
  });
});
