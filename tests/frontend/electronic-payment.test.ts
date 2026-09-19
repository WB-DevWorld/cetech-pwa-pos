import { describe, expect, test, vi } from "vitest";
import type { ApiFailure, ApiResult, PaymentState, RefundState } from "../../docs/contracts/domain.generated";
import { createElectronicPaymentController } from "../../apps/pos-web/src/features/payments/electronicPaymentController";
import { createRefundReconciliationController } from "../../apps/pos-web/src/features/payments/refundReconciliationController";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ElectronicPaymentPanel } from "../../apps/pos-web/src/features/payments/ElectronicPaymentPanel";
import { idleElectronicPaymentSession } from "../../apps/pos-web/src/features/payments/electronicPaymentView";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TX = "11111111-1111-4111-8111-111111111111";
const PAYMENT = "22222222-2222-4222-8222-222222222222";
const REFUND_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const REFUND_B = "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb";

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data, correlationId: CORRELATION };
}

function failure(nextAction: ApiFailure["error"]["nextAction"], message: string, code: ApiFailure["error"]["code"] = "NOT_FOUND"): ApiFailure {
  return {
    ok: false,
    correlationId: CORRELATION,
    error: { code, message, retryable: nextAction === "resolve", nextAction },
  };
}

function payment(partial: Partial<PaymentState> & Pick<PaymentState, "status" | "nextAction">): PaymentState {
  const base = {
    transactionId: TX,
    paymentId: PAYMENT,
    tender: "mobile_money" as const,
    amount: { minor: 1500, currency: "GHS" },
    ...partial,
  };
  if (base.status === "verified") {
    return { ...base, status: "verified", verifiedAt: "2026-09-15T18:00:00.000Z", nextAction: base.nextAction };
  }
  return base as PaymentState;
}

function uuidSequence(values: string[]): () => string {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? values[0]!;
}

describe("FE-06 electronic payment", () => {
  test("1 pending payment visibly says not to charge again", async () => {
    const initialize = vi.fn(async () => success(payment({ status: "pending", nextAction: "wait" })));
    const resolve = vi.fn(async () => failure("none", "none"));
    const controller = createElectronicPaymentController({
      payments: { initialize, resolve },
      createUuid: uuidSequence(["k1", "c1", "k2", "c2"]),
    });
    await controller.present({ transactionId: TX, tender: "mobile_money" });
    const html = renderToStaticMarkup(
      createElement(ElectronicPaymentPanel, {
        session: controller.getSession(),
        inFlight: false,
        selectedTender: "mobile_money",
        onSelectedTenderChange: () => undefined,
        onPresent: () => undefined,
        onResolve: () => undefined,
        onContinueWaiting: () => undefined,
        onContactManager: () => undefined,
      }),
    );
    expect(controller.getSession().doNotChargeAgain).toBe(true);
    expect(html).toContain("Do not charge again.");
    expect(html).toContain('data-do-not-charge-again="true"');
    expect(html).toContain('role="alert"');
  });

  test("2 pending or reconciling state does not reinitialize payment", async () => {
    const initialize = vi.fn(async () => success(payment({ status: "pending", nextAction: "wait" })));
    const resolve = vi.fn()
      .mockResolvedValueOnce(failure("none", "not found"))
      .mockResolvedValue(success(payment({ status: "reconciling", nextAction: "resolve" })));
    const controller = createElectronicPaymentController({
      payments: { initialize, resolve },
      createUuid: uuidSequence(["k1", "c1"]),
    });
    await controller.present({ transactionId: TX, tender: "mobile_money" });
    expect(initialize).toHaveBeenCalledTimes(1);
    await controller.present({ transactionId: TX, tender: "card" });
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalled();
    expect(controller.getSession().paymentId).toBe(PAYMENT);
  });

  test("3 repeated resolve click is guarded while a request is in flight", async () => {
    let release!: (value: ApiResult<PaymentState>) => void;
    const pending = new Promise<ApiResult<PaymentState>>((resolvePromise) => {
      release = resolvePromise;
    });
    const resolve = vi.fn(async () => pending);
    const initialize = vi.fn(async () => failure("none", "none"));
    const controller = createElectronicPaymentController({
      payments: { initialize, resolve },
      createUuid: uuidSequence(["k1", "c1"]),
    });
    const first = controller.present({ transactionId: TX, tender: "mobile_money" });
    await Promise.resolve();
    const second = controller.resolve();
    const third = controller.resolve();
    release(success(payment({ status: "pending", nextAction: "wait" })));
    await first;
    await second;
    await third;
    expect(resolve.mock.calls.length).toBe(1);
  });

  test("4 verified is shown only from authoritative PaymentState", async () => {
    const initialize = vi.fn(async () => success(payment({ status: "verified", nextAction: "none" })));
    const resolve = vi.fn(async () => failure("none", "none"));
    const controller = createElectronicPaymentController({
      payments: { initialize, resolve },
      createUuid: uuidSequence(["k1", "c1"]),
    });
    await controller.present({ transactionId: TX, tender: "mobile_money" });
    expect(controller.getSession().verified).toBe(true);
    expect(controller.getSession().status).toBe("verified");
    const idleHtml = renderToStaticMarkup(
      createElement(ElectronicPaymentPanel, {
        session: idleElectronicPaymentSession(),
        inFlight: false,
        selectedTender: "mobile_money",
        onSelectedTenderChange: () => undefined,
        onPresent: () => undefined,
        onResolve: () => undefined,
        onContinueWaiting: () => undefined,
        onContactManager: () => undefined,
      }),
    );
    expect(idleHtml).toContain('data-payment-verified="false"');
  });

  test("5 failed and cancelled are distinct from pending", async () => {
    const resolve = vi.fn()
      .mockResolvedValueOnce(success(payment({ status: "failed", nextAction: "none" })))
      .mockResolvedValueOnce(success(payment({ status: "cancelled", nextAction: "none" })))
      .mockResolvedValueOnce(success(payment({ status: "pending", nextAction: "wait" })));
    const initialize = vi.fn(async () => failure("none", "none"));
    const failed = createElectronicPaymentController({ payments: { initialize, resolve }, createUuid: uuidSequence(["a", "b"]) });
    await failed.present({ transactionId: TX, tender: "card" });
    expect(failed.getSession().status).toBe("failed");
    expect(failed.getSession().doNotChargeAgain).toBe(false);
    const cancelled = createElectronicPaymentController({ payments: { initialize, resolve }, createUuid: uuidSequence(["c", "d"]) });
    await cancelled.present({ transactionId: TX, tender: "card" });
    expect(cancelled.getSession().status).toBe("cancelled");
    expect(cancelled.getSession().doNotChargeAgain).toBe(false);
    const pendingCtl = createElectronicPaymentController({ payments: { initialize, resolve }, createUuid: uuidSequence(["e", "f"]) });
    await pendingCtl.present({ transactionId: TX, tender: "card" });
    expect(pendingCtl.getSession().status).toBe("pending");
    expect(pendingCtl.getSession().doNotChargeAgain).toBe(true);
  });

  test("6 requires-attention tells the cashier to escalate rather than retry blindly", async () => {
    const resolve = vi.fn(async () => success(payment({ status: "requires_attention", nextAction: "contact_manager" })));
    const controller = createElectronicPaymentController({
      payments: { initialize: vi.fn(async () => failure("none", "none")), resolve },
      createUuid: uuidSequence(["k1", "c1"]),
    });
    await controller.present({ transactionId: TX, tender: "mobile_money" });
    const html = renderToStaticMarkup(
      createElement(ElectronicPaymentPanel, {
        session: controller.getSession(),
        inFlight: false,
        selectedTender: "mobile_money",
        onSelectedTenderChange: () => undefined,
        onPresent: () => undefined,
        onResolve: () => undefined,
        onContinueWaiting: () => undefined,
        onContactManager: () => undefined,
      }),
    );
    expect(html).toContain("Contact manager");
    expect(html).toContain("Do not charge again.");
    expect(html).not.toContain(">Present payment<");
    expect(controller.getSession().contactManager).toBe(true);
    expect(controller.getSession().presentAllowed).toBe(false);
  });

  test("7 provider callback or browser success is not treated as verified", async () => {
    const resolve = vi.fn(async () => success(payment({ status: "pending", nextAction: "wait" })));
    const controller = createElectronicPaymentController({
      payments: { initialize: vi.fn(async () => failure("none", "none")), resolve },
      createUuid: uuidSequence(["k1", "c1"]),
    });
    await controller.present({ transactionId: TX, tender: "mobile_money" });
    await controller.noteBrowserCallback();
    expect(controller.getSession().verified).toBe(false);
    expect(controller.getSession().status).toBe("pending");
    expect(controller.getSession().browserCallbackIsNotTruth).toBe(true);
    const html = renderToStaticMarkup(
      createElement(ElectronicPaymentPanel, {
        session: controller.getSession(),
        inFlight: false,
        selectedTender: "mobile_money",
        onSelectedTenderChange: () => undefined,
        onPresent: () => undefined,
        onResolve: () => undefined,
        onContinueWaiting: () => undefined,
        onContactManager: () => undefined,
      }),
    );
    expect(html).toContain("We haven&#x27;t confirmed this payment yet");
    expect(html).toContain("Do not charge again");
    expect(html).toContain('data-browser-callback-not-truth="true"');
    expect(html).toContain('data-payment-verified="false"');
  });
});

describe("UX-03 electronic waiting presentation", () => {
  test("waiting copy has no demo harness and pending says do not charge again", async () => {
    const { PaymentWaiting } = await import("../../apps/pos-web/src/features/sell/components/PaymentWaiting");
    const pending = renderToStaticMarkup(
      createElement(PaymentWaiting, {
        session: {
          ...idleElectronicPaymentSession(),
          status: "pending",
          nextAction: "wait",
          message: "Payment is still being checked.",
          doNotChargeAgain: true,
          presentAllowed: false,
          resolveAllowed: true,
        },
        inFlight: false,
        onResolve: () => undefined,
      }),
    );
    expect(pending).toContain("Do not charge again.");
    expect(pending).not.toContain("Demo controls");
    expect(pending).not.toContain("Timeout / recover");
    const waiting = renderToStaticMarkup(
      createElement(PaymentWaiting, {
        session: {
          ...idleElectronicPaymentSession(),
          status: "awaiting_customer",
          nextAction: "wait",
          message: "Waiting for customer…",
          doNotChargeAgain: true,
          presentAllowed: false,
        },
        inFlight: false,
        onResolve: () => undefined,
      }),
    );
    expect(waiting).toContain("Waiting for customer");
    expect(waiting).toContain("payment-spinner");
  });
});

describe("FE-06 refund ambiguity", () => {
  test("21 an unknown refund keeps the same refundId", async () => {
    const resolveRefund = vi.fn(async () => {
      throw new Error("network dropped");
    });
    const controller = createRefundReconciliationController({ payments: { resolveRefund } }, REFUND_A);
    await controller.resolve();
    expect(controller.getSession().refundId).toBe(REFUND_A);
    expect(controller.boundRefundId()).toBe(REFUND_A);
    expect(controller.getSession().status).toBe("unknown");
  });

  test("22 reconciliation uses refund-specific resolution", async () => {
    const resolveRefund = vi.fn(async (input: { refundId: string }): Promise<ApiResult<RefundState>> =>
      success({
        refundId: input.refundId,
        returnId: "ret-1",
        channel: "provider_electronic",
        status: "pending",
        amount: { minor: 400, currency: "GHS" },
      }),
    );
    const a = createRefundReconciliationController({ payments: { resolveRefund } }, REFUND_A);
    const b = createRefundReconciliationController({ payments: { resolveRefund } }, REFUND_B);
    await a.resolve();
    await b.resolve();
    expect(resolveRefund).toHaveBeenNthCalledWith(1, { refundId: REFUND_A });
    expect(resolveRefund).toHaveBeenNthCalledWith(2, { refundId: REFUND_B });
    expect(a.getSession().refundId).toBe(REFUND_A);
    expect(b.getSession().refundId).toBe(REFUND_B);
  });

  test("23 UI never substitutes a new refund attempt for reconciliation", async () => {
    const resolveRefund = vi.fn(async () => failure("resolve", "unknown"));
    const controller = createRefundReconciliationController({ payments: { resolveRefund } }, REFUND_A);
    await controller.resolve();
    await controller.resolve();
    expect(resolveRefund.mock.calls).toEqual([[{ refundId: REFUND_A }], [{ refundId: REFUND_A }]]);
    expect(controller.getSession().warning).toContain("Do not issue another refund.");
  });
});
