import { describe, expect, test } from "vitest";
import {
  confirmCash,
  createPay01Runtime,
  finalize,
  initializeCard,
  receipt,
  resolvePayment,
  webhook,
} from "../payments/helpers";

describe("RT-01 payment and cash regressions", () => {
  test("cash sale still verifies one payment and one receipt", async () => {
    const runtime = await createPay01Runtime();
    const cash = await confirmCash(runtime);
    expect(cash.body.ok).toBe(true);
    if (!cash.body.ok) {
      return;
    }
    const finished = await finalize(runtime, cash.body.data.paymentId);
    expect(finished.body.ok).toBe(true);
    const printed = await receipt(runtime);
    expect(printed.body.ok).toBe(true);
    const movements = await runtime.checkoutStore.listCashSales("11111111-1111-4111-8111-111111111111");
    expect(movements).toHaveLength(1);
  });

  test("electronic initialize remains stable and pending never reinitializes", async () => {
    const runtime = await createPay01Runtime();
    const first = await initializeCard(runtime);
    expect(first.body.ok).toBe(true);
    if (!first.body.ok) {
      return;
    }
    expect(first.body.data.status).toBe("awaiting_customer");
    runtime.provider.setInitializeOutcome("failed");
    const second = await initializeCard(runtime);
    expect(second.body.ok).toBe(true);
    if (second.body.ok) {
      expect(second.body.data.paymentId).toBe(first.body.data.paymentId);
    }
    expect(runtime.provider.initializeCount).toBe(1);
  });

  test("initialize leaves payment unverified until server provider evidence exists", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    const payment = await runtime.checkoutStore.getPayment(initialized.body.data.paymentId);
    expect(payment?.status).not.toBe("verified");
  });

  test("Paystack webhook still verifies from provider evidence", async () => {
    const runtime = await createPay01Runtime();
    const initialized = await initializeCard(runtime);
    expect(initialized.body.ok).toBe(true);
    if (!initialized.body.ok) {
      return;
    }
    await webhook(
      runtime,
      JSON.stringify({
        event: "charge.success",
        data: {
          id: 4242,
          domain: "test",
          status: "success",
          reference: initialized.body.data.displayReference,
          amount: 2900,
          currency: "GHS",
        },
      }),
    );
    const resolved = await resolvePayment(runtime, initialized.body.data.paymentId);
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("verified");
    }
  });
});
