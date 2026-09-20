import { describe, expect, test } from "vitest";
import { handlePrepareSale } from "../../../apps/pos-web/src/server/sales/handle-prepare-sale";
import {
  cashierAssignments,
  commandBase,
  createPay01Runtime,
  DEVICE_ID,
  FINGERPRINT,
} from "../payments/helpers";

const TX_PREP = "11111111-1111-4111-8111-111111111881";
const PREP_KEY = "22222222-2222-4222-8222-222222222881";

describe("R10 fail-closed sale prepare guards", () => {
  test("wrong register assignment is denied before Woo order or stock-reservation effect", async () => {
    const runtime = await createPay01Runtime();

    const prepared = await handlePrepareSale({
      ...commandBase(runtime.sessions.cookieHeader),
      assignments: cashierAssignments(["reg_other"]),
      idempotencyKeyHeader: PREP_KEY,
      body: {
        transactionId: TX_PREP,
        registerId: "reg_a1",
        shiftId: runtime.shiftId,
        deviceId: DEVICE_ID,
        quoteId: "quote-r10-guard",
        quoteFingerprint: FINGERPRINT,
      },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      salesPort: runtime.salesPort,
    });

    expect(prepared.body.ok).toBe(false);
    if (!prepared.body.ok) {
      expect(prepared.body.error.code).toBe("FORBIDDEN");
    }
    expect(runtime.salesPort.wooOrderCount).toBe(0);
    expect(runtime.salesPort.stockReserveCount).toBe(0);
  });

  test("missing CSRF protection is denied before Woo order or stock-reservation effect", async () => {
    const runtime = await createPay01Runtime();

    const prepared = await handlePrepareSale({
      ...commandBase(runtime.sessions.cookieHeader),
      csrfHeader: null,
      idempotencyKeyHeader: PREP_KEY,
      body: {
        transactionId: TX_PREP,
        registerId: "reg_a1",
        shiftId: runtime.shiftId,
        deviceId: DEVICE_ID,
        quoteId: "quote-r10-guard",
        quoteFingerprint: FINGERPRINT,
      },
      sessionStore: runtime.sessions.store,
      checkoutStore: runtime.checkoutStore,
      salesPort: runtime.salesPort,
    });

    expect(prepared.body.ok).toBe(false);
    if (!prepared.body.ok) {
      expect(prepared.body.error.code).toBe("FORBIDDEN");
    }
    expect(runtime.salesPort.wooOrderCount).toBe(0);
    expect(runtime.salesPort.stockReserveCount).toBe(0);
  });
});
