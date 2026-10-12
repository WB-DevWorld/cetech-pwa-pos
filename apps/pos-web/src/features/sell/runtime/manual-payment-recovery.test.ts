import "fake-indexeddb/auto";
import { describe, expect, test, vi } from "vitest";
import type { PaymentState, PreparedSale, Quote, ReceiptSnapshot, SaleResolution } from "../../../../../../docs/contracts/domain.generated";
import type { ApiResult } from "../../../../../../docs/contracts/ports";
import { openPosLocalDatabase } from "../../../local";
import { createCashCheckoutController, type CashCheckoutPorts } from "./cashCheckoutController";
import { createCheckoutAttemptStore, discardCheckoutAttemptMemory } from "./checkout-attempt-store";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAYMENT = "15151515-1515-4515-8515-151515151515";

function quote(): Quote {
  return {
    id: "quote-live-1",
    fingerprint: "fp-live-1",
    cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    cartRevision: 1,
    customer: { kind: "walkin" },
    locationId: "loc-front-1",
    currency: "GHS",
    lines: [],
    subtotal: { minor: 500, currency: "GHS" },
    discount: { minor: 0, currency: "GHS" },
    tax: { minor: 0, currency: "GHS" },
    total: { minor: 500, currency: "GHS" },
    calculatedAt: "2026-10-12T12:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    purchasable: true,
  };
}

function prepared(transactionId: string): PreparedSale {
  return {
    transactionId,
    saleId: "sale-1",
    orderReference: "POS-1",
    quoteFingerprint: "fp-live-1",
    total: { minor: 500, currency: "GHS" },
    status: "prepared",
    stockCommitment: "reserved",
    preparedAt: "2026-10-12T12:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
}

function harness() {
  let n = 0;
  const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
  const confirmCash = vi.fn();
  const resolvePayment = vi.fn();
  const finalize = vi.fn();
  const resolveSale = vi.fn();
  const cancel = vi.fn();
  const getByTransaction = vi.fn();
  const prepare = vi.fn(async (input: { transactionId: string }): Promise<ApiResult<PreparedSale>> => ({
    ok: true,
    correlationId: CORRELATION,
    data: prepared(input.transactionId),
  }));
  const ports: CashCheckoutPorts = {
    checkout: { prepare: prepare as CashCheckoutPorts["checkout"]["prepare"], finalize },
    payments: { confirmCash: confirmCash as CashCheckoutPorts["payments"]["confirmCash"], resolve: resolvePayment },
    sales: { resolve: resolveSale, cancel },
    receipts: { getByTransaction },
    printer: { print: vi.fn() },
    scope: { registerId: "reg_a", shiftId: "shift-1", deviceId: "device-1" },
    createUuid: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    },
    attemptStore: createCheckoutAttemptStore(db),
  };
  return { db, ports, confirmCash, resolvePayment, finalize, resolveSale, cancel, getByTransaction };
}

describe("manual payment recovery", () => {
  test("a remount keeps the same manual transaction and command keys", async () => {
    const { db, ports, confirmCash } = harness();
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quote());
    expect(controller.getSession().stage).toBe("choose_payment");
    const keys = await controller.prepareManualTender();
    const stored = ports.attemptStore?.readSync();
    expect(keys?.begin.idempotencyKey).toBe(stored?.manualBeginKey);
    expect(keys?.confirm.idempotencyKey).toBe(stored?.manualConfirmKey);
    expect(stored?.tenderKind).toBe("manual_mobile_money");
    expect(stored?.paymentId).toBeUndefined();

    discardCheckoutAttemptMemory(db.name);
    const reloadedStore = createCheckoutAttemptStore(db);
    await reloadedStore.hydrate();
    const reloaded = createCashCheckoutController({ ...ports, attemptStore: reloadedStore });
    const again = await reloaded.prepareManualTender();
    expect(again?.begin.idempotencyKey).toBe(keys?.begin.idempotencyKey);
    expect(again?.confirm.idempotencyKey).toBe(keys?.confirm.idempotencyKey);
    expect(reloaded.getSession().transactionId).toBe(stored?.transactionId);
    expect(confirmCash).not.toHaveBeenCalled();
  });

  test("a failed attempt save returns no manual keys and sends no payment", async () => {
    let n = 0;
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const inner = createCheckoutAttemptStore(db);
    const confirmCash = vi.fn();
    const prepare = vi.fn(async (input: { transactionId: string }): Promise<ApiResult<PreparedSale>> => ({
      ok: true,
      correlationId: CORRELATION,
      data: prepared(input.transactionId),
    }));
    const ports: CashCheckoutPorts = {
      checkout: { prepare: prepare as CashCheckoutPorts["checkout"]["prepare"], finalize: vi.fn() },
      payments: { confirmCash: confirmCash as CashCheckoutPorts["payments"]["confirmCash"], resolve: vi.fn() },
      sales: { resolve: vi.fn(), cancel: vi.fn() },
      receipts: { getByTransaction: vi.fn() },
      printer: { print: vi.fn() },
      scope: { registerId: "reg_a", shiftId: "shift-1", deviceId: "device-1" },
      createUuid: () => {
        n += 1;
        return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
      },
      attemptStore: {
        readSync: () => inner.readSync(),
        hydrate: () => inner.hydrate(),
        async write(record) {
          if (record.tenderKind === "manual_mobile_money") {
            throw new Error("disk");
          }
          await inner.write(record);
        },
        clear: () => inner.clear(),
      },
    };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quote());
    await expect(controller.prepareManualTender()).resolves.toBeNull();
    expect(confirmCash).not.toHaveBeenCalled();
    expect(inner.readSync()?.manualBeginKey).toBeUndefined();
    expect(inner.readSync()?.tenderKind).toBeUndefined();
  });

  test("cash, back, and cancel do nothing while manual payment work is unresolved", async () => {
    const { ports, confirmCash, cancel } = harness();
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quote());
    await controller.prepareManualTender();
    controller.setManualActivity(true);
    controller.selectCash();
    controller.backToPaymentChoice();
    await controller.cancelPreparedSale();
    expect(controller.getSession().stage).toBe("choose_payment");
    expect(controller.getSession().manualResume).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
    expect(confirmCash).not.toHaveBeenCalled();
  });

  test("a lost finalize resumes the same sale with one receipt and the saved merchant reference", async () => {
    const { ports, confirmCash, resolvePayment, finalize, resolveSale, getByTransaction } = harness();
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quote());
    const transactionId = controller.getSession().transactionId ?? "";
    controller.retainManualPayment(PAYMENT);
    controller.noteManualReference("MM-WIN");
    resolvePayment.mockImplementation(async (): Promise<ApiResult<PaymentState>> => ({
      ok: true,
      correlationId: CORRELATION,
      data: {
        transactionId,
        paymentId: PAYMENT,
        tender: "mobile_money",
        status: "verified",
        amount: { minor: 500, currency: "GHS" },
        verifiedAt: "2026-10-12T12:05:00.000Z",
        nextAction: "none",
      },
    }));
    finalize.mockImplementationOnce(() => Promise.reject(new Error("response lost")));
    resolveSale.mockImplementation(async (): Promise<ApiResult<SaleResolution>> => ({
      ok: true,
      correlationId: CORRELATION,
      data: {
        transactionId,
        status: "completed",
        saleId: "sale-1",
        orderReference: "POS-1",
        paymentId: PAYMENT,
        receiptId: "rcpt-1",
      },
    }));
    const receipt: ReceiptSnapshot = {
      id: "rcpt-1",
      transactionId,
      receiptNumber: "POS-1",
      orderReference: "POS-1",
      issuedAt: "2026-10-12T12:06:00.000Z",
      locationName: "Store",
      registerName: "Register A",
      cashierName: "Ada",
      customerLabel: "Walk-in",
      lines: [],
      subtotal: { minor: 500, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
      total: { minor: 500, currency: "GHS" },
      tender: "mobile_money",
      documentKind: "operational_pos_receipt",
    };
    getByTransaction.mockImplementation(async (): Promise<ApiResult<ReceiptSnapshot>> => ({
      ok: true,
      correlationId: CORRELATION,
      data: receipt,
    }));
    await controller.resolvePayment();
    expect(resolvePayment).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(getByTransaction).toHaveBeenCalledTimes(1);
    expect(confirmCash).not.toHaveBeenCalled();
    expect(controller.getSession().transactionId).toBe(transactionId);
    expect(controller.getSession().receipt?.merchantReference).toBe("MM-WIN");
    expect(controller.getSession().stage).toBe("receipt_ready");
  });
});
