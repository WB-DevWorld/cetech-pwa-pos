import { describe, expect, test } from "vitest";
import { handleConfirmCash } from "../../../apps/pos-web/src/server/sales/handle-confirm-cash";
import {
  cashierAssignments,
  commandBase,
  createPay01Runtime,
  ghs,
  TX_A,
} from "../payments/helpers";

const CASH_KEY = "22222222-2222-4222-8222-222222222882";

describe("R10 fail-closed cash guards", () => {
  test("wrong register assignment is denied before cash movement or payment evidence", async () => {
    const runtime = await createPay01Runtime();

    const result = await handleConfirmCash({
      ...commandBase(runtime.sessions.cookieHeader),
      assignments: cashierAssignments(["reg_other"]),
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(3000) },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
    });

    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("FORBIDDEN");
    }
    expect(await runtime.checkoutStore.listCashSales(TX_A)).toHaveLength(0);
    await expect(runtime.checkoutStore.getPaymentForTransaction(TX_A)).resolves.toBeUndefined();
  });

  test("missing CSRF protection is denied before cash movement or payment evidence", async () => {
    const runtime = await createPay01Runtime();

    const result = await handleConfirmCash({
      ...commandBase(runtime.sessions.cookieHeader),
      csrfHeader: null,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(3000) },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
    });

    expect(result.body.ok).toBe(false);
    if (!result.body.ok) {
      expect(result.body.error.code).toBe("FORBIDDEN");
    }
    expect(await runtime.checkoutStore.listCashSales(TX_A)).toHaveLength(0);
    await expect(runtime.checkoutStore.getPaymentForTransaction(TX_A)).resolves.toBeUndefined();
  });
});
