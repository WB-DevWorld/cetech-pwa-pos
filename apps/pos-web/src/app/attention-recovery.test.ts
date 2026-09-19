import { describe, expect, test, vi } from "vitest";
import type { ApiResult, PaymentPort, SalesPort } from "../../../../docs/contracts/ports";
import type { PaymentState, SaleResolution } from "../../../../docs/contracts/domain.generated";
import type { AttentionItemView } from "../ui/operational";
import {
  createAttentionRecoveryLock,
  recoverAttentionItem,
  runAttentionRecovery,
} from "./attention-recovery";

const TX = "11111111-1111-4111-8111-111111111077";
const PAYMENT = "22222222-2222-4222-8222-222222222077";
const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function paymentOk(status: PaymentState["status"] = "pending"): ApiResult<PaymentState> {
  return {
    ok: true,
    correlationId: CORRELATION,
    data: {
      transactionId: TX,
      paymentId: PAYMENT,
      tender: "mobile_money",
      status,
      amount: { minor: 1000, currency: "GHS" },
      nextAction: status === "verified" ? "none" : "resolve",
      ...(status === "verified" ? { verifiedAt: "2026-09-19T12:00:00.000Z" as const } : {}),
    } as PaymentState,
  };
}

function saleOk(status: SaleResolution["status"] = "requires_attention"): ApiResult<SaleResolution> {
  return {
    ok: true,
    correlationId: CORRELATION,
    data: { transactionId: TX, status },
  };
}

const paymentItem: AttentionItemView = {
  id: `payment:${PAYMENT}`,
  title: "Payment awaiting verification",
  summary: "This payment is still being checked.",
  typeLabel: "payment",
  severity: "medium",
  transactionReference: "TX-PENDING-1",
  transactionId: TX,
  paymentId: PAYMENT,
  resolveAllowed: true,
  recoverKind: "payment",
};

const saleItem: AttentionItemView = {
  id: `sale:${TX}`,
  title: "Sale needs review",
  summary: "Resolve the existing transaction.",
  typeLabel: "sale",
  severity: "critical",
  transactionReference: "#attn",
  transactionId: TX,
  resolveAllowed: true,
  recoverKind: "sale",
};

const refundItem: AttentionItemView = {
  id: `operation:payment.refund:${TX}`,
  title: "Operation needs recovery",
  summary: "This operation needs manager or reconciliation review.",
  typeLabel: "operation",
  severity: "critical",
  transactionReference: TX,
  transactionId: TX,
  resolveAllowed: false,
  recoverKind: "return",
};

describe("UX-04 attention recovery identity", () => {
  test("payment Check / Recover calls PaymentPort.resolve once for the same transaction/payment and never initialize", async () => {
    const initialize = vi.fn();
    const resolve = vi.fn(async () => paymentOk());
    const salesResolve = vi.fn();
    const payments = { initialize, resolve } as Pick<PaymentPort, "resolve"> & { initialize: typeof initialize };
    const sales = { resolve: salesResolve } as Pick<SalesPort, "resolve">;
    const outcome = await recoverAttentionItem(paymentItem, { payments, sales });
    expect(outcome).toBe("attempted");
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith({ transactionId: TX, paymentId: PAYMENT });
    expect(initialize).not.toHaveBeenCalled();
    expect(salesResolve).not.toHaveBeenCalled();
  });

  test("sale Check / Recover calls SalesPort.resolve for the same transaction", async () => {
    const paymentResolve = vi.fn();
    const salesResolve = vi.fn(async () => saleOk());
    await recoverAttentionItem(saleItem, {
      payments: { resolve: paymentResolve },
      sales: { resolve: salesResolve },
    });
    expect(salesResolve).toHaveBeenCalledTimes(1);
    expect(salesResolve).toHaveBeenCalledWith(TX);
    expect(paymentResolve).not.toHaveBeenCalled();
  });

  test("refund/return operations are not treated as sale recovery", async () => {
    const paymentResolve = vi.fn();
    const salesResolve = vi.fn();
    const outcome = await recoverAttentionItem(refundItem, {
      payments: { resolve: paymentResolve },
      sales: { resolve: salesResolve },
    });
    expect(outcome).toBe("unsupported");
    expect(paymentResolve).not.toHaveBeenCalled();
    expect(salesResolve).not.toHaveBeenCalled();
  });

  test("attention reload runs after recovery and unresolved durable state remains", async () => {
    const inbox = [paymentItem];
    const resolve = vi.fn(async () => paymentOk("requires_attention"));
    const reload = vi.fn(async () => undefined);
    const lock = createAttentionRecoveryLock();
    const status = await runAttentionRecovery({
      item: paymentItem,
      lock,
      ports: { payments: { resolve }, sales: { resolve: vi.fn() } },
      reload,
    });
    expect(status).toBe("attempted");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(inbox).toHaveLength(1);
    expect(lock.inFlightId()).toBeNull();
  });

  test("resolved durable read result is what removes the item, not the request itself", async () => {
    let inbox: AttentionItemView[] = [paymentItem];
    const resolve = vi.fn(async () => paymentOk("verified"));
    await runAttentionRecovery({
      item: paymentItem,
      lock: createAttentionRecoveryLock(),
      ports: { payments: { resolve }, sales: { resolve: vi.fn() } },
      reload: async () => {
        inbox = [];
      },
    });
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(inbox).toEqual([]);
  });

  test("repeated recover while in-flight does not issue a duplicate resolve", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    const resolve = vi.fn(async () => {
      await gate;
      return paymentOk();
    });
    const reload = vi.fn(async () => undefined);
    const lock = createAttentionRecoveryLock();
    const ports = { payments: { resolve }, sales: { resolve: vi.fn() } };
    const first = runAttentionRecovery({ item: paymentItem, lock, ports, reload });
    const second = await runAttentionRecovery({ item: paymentItem, lock, ports, reload });
    expect(second).toBe("in_flight");
    expect(resolve).toHaveBeenCalledTimes(1);
    release?.();
    await first;
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
