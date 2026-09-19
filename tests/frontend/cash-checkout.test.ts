import { describe, expect, test, vi } from "vitest";
import type {
  ApiFailure,
  ApiResult,
  PaymentState,
  PreparedSale,
  Quote,
  ReceiptSnapshot,
  SaleResolution,
} from "../../docs/contracts/domain.generated";
import { describePayButton } from "../../apps/pos-web/src/features/sell/state/quotePresentation";
import { canBeginNewSale } from "../../apps/pos-web/src/features/sell/state/checkoutSession";
import { applyBarcodeScan, createSellWorkspace } from "../../apps/pos-web/src/features/sell/state/sellWorkspace";
import { SELL_TEST_CATALOG } from "../../apps/pos-web/src/features/sell/state/sellTestCatalog";
import { resolveQuotePresentation } from "../../apps/pos-web/src/features/sell/state/quoteRevision";
import {
  createCashCheckoutController,
  isCashCheckoutReady,
  type CashCheckoutPorts,
} from "../../apps/pos-web/src/features/sell/runtime/cashCheckoutController";
import { previousConfirmedQuoteForRequest } from "../../apps/pos-web/src/features/sell/runtime/useCartQuote";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TX = "11111111-1111-4111-8111-111111111111";
const PAYMENT = "22222222-2222-4222-8222-222222222222";
const PREPARE_KEY = "33333333-3333-4333-8333-333333333333";
const PREPARE_CORR = "44444444-4444-4444-8444-444444444444";
const CASH_KEY = "55555555-5555-4555-8555-555555555555";
const CASH_CORR = "66666666-6666-4666-8666-666666666666";
const FINALIZE_KEY = "77777777-7777-4777-8777-777777777777";
const FINALIZE_CORR = "88888888-8888-4888-8888-888888888888";

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data, correlationId: CORRELATION };
}

function failure(nextAction: ApiFailure["error"]["nextAction"], message: string): ApiFailure {
  return {
    ok: false,
    correlationId: CORRELATION,
    error: {
      code: "INTEGRATION_UNAVAILABLE",
      message,
      retryable: nextAction !== "none",
      nextAction,
    },
  };
}

function quoteFixture(): Quote {
  return {
    id: "quote-live-1",
    fingerprint: "fp-live-1",
    cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    cartRevision: 1,
    customer: { kind: "walkin" },
    locationId: "loc-front-1",
    currency: "GHS",
    lines: [
      {
        lineId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        productId: "p-hardener",
        quantity: "1",
        unitPrice: { minor: 1500, currency: "GHS" },
        subtotal: { minor: 1500, currency: "GHS" },
        discount: { minor: 0, currency: "GHS" },
        tax: { minor: 0, currency: "GHS" },
        total: { minor: 1500, currency: "GHS" },
        stockStatus: "in_stock",
        purchasable: true,
        problems: [],
      },
    ],
    subtotal: { minor: 1500, currency: "GHS" },
    discount: { minor: 0, currency: "GHS" },
    tax: { minor: 0, currency: "GHS" },
    total: { minor: 1500, currency: "GHS" },
    calculatedAt: "2026-09-13T20:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    purchasable: true,
  };
}

function preparedSale(transactionId = TX): PreparedSale {
  return {
    transactionId,
    saleId: "sale-1",
    orderReference: "POS-1001",
    quoteFingerprint: "fp-live-1",
    total: { minor: 1500, currency: "GHS" },
    status: "prepared",
    stockCommitment: "reserved",
    preparedAt: "2026-09-14T18:00:00.000Z",
    expiresAt: "2026-09-14T19:00:00.000Z",
  };
}

function verifiedPayment(transactionId = TX): PaymentState {
  return {
    transactionId,
    paymentId: PAYMENT,
    tender: "cash",
    status: "verified",
    amount: { minor: 1500, currency: "GHS" },
    verifiedAt: "2026-09-14T18:01:00.000Z",
    nextAction: "none",
  };
}

function pendingPayment(transactionId = TX): PaymentState {
  return {
    transactionId,
    paymentId: PAYMENT,
    tender: "cash",
    status: "pending",
    amount: { minor: 1500, currency: "GHS" },
    nextAction: "wait",
  };
}

function failedPayment(transactionId = TX): PaymentState {
  return {
    transactionId,
    paymentId: PAYMENT,
    tender: "cash",
    status: "failed",
    amount: { minor: 1500, currency: "GHS" },
    nextAction: "none",
  };
}

function completedSale(transactionId = TX): SaleResolution {
  return {
    transactionId,
    status: "completed",
    saleId: "sale-1",
    orderReference: "POS-1001",
    receiptId: "receipt-port-1",
    paymentId: PAYMENT,
  };
}

function receiptSnapshot(transactionId = TX): ReceiptSnapshot {
  return {
    id: "receipt-port-1",
    transactionId,
    receiptNumber: "R-PORT-99",
    orderReference: "POS-1001",
    issuedAt: "2026-09-14T18:02:00.000Z",
    locationName: "Main store",
    registerName: "Front Counter 1",
    cashierName: "Staff",
    customerLabel: "Walk-in",
    lines: [
      {
        name: "Canonical receipt line",
        quantity: "1",
        unitPrice: { minor: 1500, currency: "GHS" },
        subtotal: { minor: 1500, currency: "GHS" },
        discount: { minor: 0, currency: "GHS" },
        tax: { minor: 0, currency: "GHS" },
        total: { minor: 1500, currency: "GHS" },
      },
    ],
    subtotal: { minor: 1500, currency: "GHS" },
    discount: { minor: 0, currency: "GHS" },
    tax: { minor: 0, currency: "GHS" },
    total: { minor: 1500, currency: "GHS" },
    tender: "cash",
    cashReceived: { minor: 2000, currency: "GHS" },
    changeDue: { minor: 500, currency: "GHS" },
    documentKind: "operational_pos_receipt",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function uuidSequence(): () => string {
  const values = [TX, PREPARE_KEY, PREPARE_CORR, CASH_KEY, CASH_CORR, FINALIZE_KEY, FINALIZE_CORR];
  let index = 0;
  return () => values[index++] ?? `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function spyPorts(overrides: Partial<CashCheckoutPorts> = {}): CashCheckoutPorts & {
  prepare: ReturnType<typeof vi.fn>;
  finalize: ReturnType<typeof vi.fn>;
  confirmCash: ReturnType<typeof vi.fn>;
  resolvePayment: ReturnType<typeof vi.fn>;
  resolveSale: ReturnType<typeof vi.fn>;
  cancelSale: ReturnType<typeof vi.fn>;
  getReceipt: ReturnType<typeof vi.fn>;
  print: ReturnType<typeof vi.fn>;
} {
  const prepare = vi.fn(async () => success(preparedSale()));
  const finalize = vi.fn(async () => success(completedSale()));
  const confirmCash = vi.fn(async () => success(verifiedPayment()));
  const resolvePayment = vi.fn(async () => success(verifiedPayment()));
  const resolveSale = vi.fn(async () => success(completedSale()));
  const cancelSale = vi.fn(async () =>
    success({ transactionId: TX, status: "cancelled" as const, saleId: "sale-1", orderReference: "POS-1001" }),
  );
  const getReceipt = vi.fn(async () => success(receiptSnapshot()));
  const print = vi.fn(async () => ({ status: "dialog_opened" as const }));
  const ports: CashCheckoutPorts & {
    prepare: typeof prepare;
    finalize: typeof finalize;
    confirmCash: typeof confirmCash;
    resolvePayment: typeof resolvePayment;
    resolveSale: typeof resolveSale;
    cancelSale: typeof cancelSale;
    getReceipt: typeof getReceipt;
    print: typeof print;
  } = {
    prepare,
    finalize,
    confirmCash,
    resolvePayment,
    resolveSale,
    cancelSale,
    getReceipt,
    print,
    checkout: { prepare, finalize },
    payments: { confirmCash, resolve: resolvePayment },
    sales: { resolve: resolveSale, cancel: cancelSale },
    receipts: { getByTransaction: getReceipt },
    printer: { print },
    scope: {
      registerId: "reg-front-1",
      shiftId: "shift-open-1",
      deviceId: "device-1",
    },
    createUuid: uuidSequence(),
    ...overrides,
  };
  if (!overrides.checkout) {
    ports.checkout = { prepare, finalize };
  }
  if (!overrides.payments) {
    ports.payments = { confirmCash, resolve: resolvePayment };
  }
  if (!overrides.sales) {
    ports.sales = { resolve: resolveSale, cancel: cancelSale };
  }
  if (!overrides.receipts) {
    ports.receipts = { getByTransaction: getReceipt };
  }
  if (!overrides.printer) {
    ports.printer = { print };
  }
  return ports;
}

async function completeSale(controller: ReturnType<typeof createCashCheckoutController>, ports: ReturnType<typeof spyPorts>) {
  await controller.startPrepare(quoteFixture());
  controller.selectCash();
  await controller.confirmCash("20.00");
  expect(controller.getSession().stage).toBe("receipt_ready");
  expect(ports.prepare).toHaveBeenCalledTimes(1);
  expect(ports.confirmCash).toHaveBeenCalledTimes(1);
  expect(ports.finalize).toHaveBeenCalledTimes(1);
}

describe("FE-05 cash checkout and receipt UX", () => {
  test("1. Pay remains unavailable when checkout eligibility is false", () => {
    const pay = describePayButton(
      { allowed: false, reason: "QUOTE_REQUIRED", message: "Checkout is unavailable until the price is ready." },
      { checkoutReady: true },
    );
    expect(pay.disabled).toBe(true);
    expect(pay.eligibilityAllowed).toBe(false);
  });

  test("2. Pay becomes actionable only with eligible quote state and required runtime dependencies", () => {
    expect(isCashCheckoutReady(undefined)).toBe(false);
    expect(describePayButton({ allowed: true }).disabled).toBe(true);
    const ports = spyPorts();
    expect(isCashCheckoutReady(ports)).toBe(true);
    expect(describePayButton({ allowed: true }, { checkoutReady: true }).disabled).toBe(false);
  });

  test("3. Rapid double click does not invoke prepare twice", async () => {
    const gate = deferred<ApiResult<PreparedSale>>();
    const ports = spyPorts();
    ports.prepare.mockImplementation(async () => gate.promise);
    ports.checkout = { prepare: ports.prepare, finalize: ports.finalize };
    const controller = createCashCheckoutController(ports);
    const first = controller.startPrepare(quoteFixture());
    const second = controller.startPrepare(quoteFixture());
    expect(ports.prepare).toHaveBeenCalledTimes(1);
    gate.resolve(success(preparedSale()));
    await Promise.all([first, second]);
    expect(ports.prepare).toHaveBeenCalledTimes(1);
    expect(ports.prepare.mock.calls[0]?.[1]).toEqual({
      idempotencyKey: PREPARE_KEY,
      correlationId: PREPARE_CORR,
    });
  });

  test("4. Prepare failure preserves the cart/draft and presents a recoverable failure state", async () => {
    const cart = { lines: ["kept-line"] };
    const ports = spyPorts();
    ports.prepare.mockResolvedValue(failure("retry_same_key", "Stock changed"));
    ports.checkout = { prepare: ports.prepare, finalize: ports.finalize };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    expect(cart.lines).toEqual(["kept-line"]);
    expect(controller.getSession().stage).toBe("prepare_failed");
    expect(controller.getSession().message).toBe("Prices couldn't be checked. Check the connection and try again.");
    expect(controller.getSession().saleCompleted).toBe(false);
    expect(ports.confirmCash).not.toHaveBeenCalled();
    expect(ports.finalize).not.toHaveBeenCalled();
  });

  test("5. Ambiguous/timeout behavior uses resolve rather than preparing again", async () => {
    const ports = spyPorts();
    ports.prepare.mockRejectedValue(new Error("timeout"));
    ports.resolveSale.mockResolvedValue(
      success({
        transactionId: TX,
        status: "prepared",
        saleId: "sale-1",
        orderReference: "POS-1001",
      }),
    );
    ports.checkout = { prepare: ports.prepare, finalize: ports.finalize };
    ports.sales = { resolve: ports.resolveSale, cancel: ports.cancelSale };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    expect(ports.prepare).toHaveBeenCalledTimes(1);
    expect(ports.resolveSale).toHaveBeenCalledTimes(1);
    expect(ports.resolveSale).toHaveBeenCalledWith(TX);
    await controller.startPrepare(quoteFixture());
    expect(ports.prepare).toHaveBeenCalledTimes(1);
    expect(controller.getSession().stage).toBe("choose_payment");
    expect(controller.getSession().prepared?.transactionId).toBe(TX);
  });

  test("6. Cash confirmation cannot be started multiple times by repeated clicks", async () => {
    const gate = deferred<ApiResult<PaymentState>>();
    const ports = spyPorts();
    ports.confirmCash.mockImplementation(async () => gate.promise);
    ports.payments = { confirmCash: ports.confirmCash, resolve: ports.resolvePayment };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    controller.selectCash();
    const first = controller.confirmCash("20.00");
    const second = controller.confirmCash("20.00");
    expect(ports.confirmCash).toHaveBeenCalledTimes(1);
    gate.resolve(success(verifiedPayment()));
    await Promise.all([first, second]);
    expect(ports.confirmCash).toHaveBeenCalledTimes(1);
    expect(ports.confirmCash.mock.calls[0]?.[0]).toEqual({
      transactionId: TX,
      cashReceived: { minor: 2000, currency: "GHS" },
    });
    expect(ports.confirmCash.mock.calls[0]?.[1]).toEqual({
      idempotencyKey: CASH_KEY,
      correlationId: CASH_CORR,
    });
  });

  test("7. Finalization is visually distinct from payment/cash confirmation", async () => {
    const finalizeGate = deferred<ApiResult<SaleResolution>>();
    const ports = spyPorts();
    ports.finalize.mockImplementation(async () => finalizeGate.promise);
    ports.checkout = { prepare: ports.prepare, finalize: ports.finalize };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    expect(controller.getSession().stage).toBe("choose_payment");
    controller.selectCash();
    expect(controller.getSession().stage).toBe("cash");
    const pending = controller.confirmCash("15.00");
    for (let i = 0; i < 20 && controller.getSession().stage !== "finalizing"; i += 1) {
      await Promise.resolve();
    }
    expect(controller.getSession().stage).toBe("finalizing");
    expect(controller.getSession().message).toMatch(/Completing the sale/i);
    expect(controller.getSession().stage).not.toBe("confirming_cash");
    finalizeGate.resolve(success(completedSale()));
    await pending;
  });

  test("8. Receipt is not displayed before authoritative completion", async () => {
    const ports = spyPorts();
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    expect(controller.getSession().receipt).toBeUndefined();
    expect(controller.getSession().saleCompleted).toBe(false);
    controller.selectCash();
    await controller.confirmCash("15.00");
    expect(controller.getSession().saleCompleted).toBe(true);
    expect(controller.getSession().receipt?.receiptNumber).toBe("R-PORT-99");
  });

  test("9. Receipt shown to the user originates from ReceiptPort", async () => {
    const ports = spyPorts();
    const controller = createCashCheckoutController(ports);
    await completeSale(controller, ports);
    expect(ports.getReceipt).toHaveBeenCalledWith(TX);
    expect(controller.getSession().receipt?.receiptNumber).toBe("R-PORT-99");
    expect(controller.getSession().receipt?.lines[0]?.name).toBe("Canonical receipt line");
    expect(controller.getSession().receipt?.changeDue).toEqual({ minor: 500, currency: "GHS" });
  });

  test("10. Failed receipt retrieval after completed sale does not repeat the sale", async () => {
    const ports = spyPorts();
    ports.getReceipt.mockResolvedValue(failure("retry_same_key", "Receipt unavailable"));
    ports.receipts = { getByTransaction: ports.getReceipt };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    controller.selectCash();
    await controller.confirmCash("15.00");
    expect(controller.getSession().stage).toBe("receipt_failed");
    expect(controller.getSession().saleCompleted).toBe(true);
    expect(controller.getSession().receipt).toBeUndefined();
    expect(ports.prepare).toHaveBeenCalledTimes(1);
    expect(ports.confirmCash).toHaveBeenCalledTimes(1);
    expect(ports.finalize).toHaveBeenCalledTimes(1);
    await controller.loadReceipt();
    expect(ports.prepare).toHaveBeenCalledTimes(1);
    expect(ports.confirmCash).toHaveBeenCalledTimes(1);
    expect(ports.finalize).toHaveBeenCalledTimes(1);
    expect(ports.getReceipt).toHaveBeenCalledTimes(2);
  });

  test("11. Failed print does not call prepare/payment/finalize again", async () => {
    const ports = spyPorts();
    ports.print.mockResolvedValue({ status: "failed", message: "Printer offline" });
    ports.printer = { print: ports.print };
    const controller = createCashCheckoutController(ports);
    await completeSale(controller, ports);
    await controller.printReceipt();
    expect(controller.getSession().stage).toBe("print_failed");
    expect(controller.getSession().saleCompleted).toBe(true);
    expect(ports.prepare).toHaveBeenCalledTimes(1);
    expect(ports.confirmCash).toHaveBeenCalledTimes(1);
    expect(ports.finalize).toHaveBeenCalledTimes(1);
    expect(ports.print).toHaveBeenCalledWith({ receiptId: "receipt-port-1", reason: "initial" });
  });

  test("12. Retry print/reprint affects only printing/receipt behavior", async () => {
    const ports = spyPorts();
    ports.print.mockResolvedValueOnce({ status: "failed", message: "Printer offline" }).mockResolvedValueOnce({
      status: "dialog_opened",
    });
    ports.printer = { print: ports.print };
    const controller = createCashCheckoutController(ports);
    await completeSale(controller, ports);
    await controller.printReceipt();
    await controller.printReceipt();
    expect(ports.print).toHaveBeenNthCalledWith(1, { receiptId: "receipt-port-1", reason: "initial" });
    expect(ports.print).toHaveBeenNthCalledWith(2, { receiptId: "receipt-port-1", reason: "reprint" });
    expect(ports.prepare).toHaveBeenCalledTimes(1);
    expect(ports.confirmCash).toHaveBeenCalledTimes(1);
    expect(ports.finalize).toHaveBeenCalledTimes(1);
    expect(controller.getSession().printStatus).toBe("dialog_opened");
  });

  test("13. Sale completion can transition to a fresh New Sale without retaining prior checkout/receipt state", async () => {
    const ports = spyPorts();
    const controller = createCashCheckoutController(ports);
    await completeSale(controller, ports);
    expect(controller.getSession().receipt).toBeDefined();
    controller.resetForNewSale();
    const next = controller.getSession();
    expect(next.stage).toBe("idle");
    expect(next.saleCompleted).toBe(false);
    expect(next.receipt).toBeUndefined();
    expect(next.prepared).toBeUndefined();
  });

  test("14. Checkout failure/unknown state does not silently clear the existing draft", async () => {
    const draft = { cartId: "cart-keep", lines: 2 };
    const ports = spyPorts();
    ports.prepare.mockResolvedValue(failure("resolve", "unknown"));
    ports.resolveSale.mockResolvedValue(
      success({ transactionId: TX, status: "preparing", message: "Still preparing" }),
    );
    ports.checkout = { prepare: ports.prepare, finalize: ports.finalize };
    ports.sales = { resolve: ports.resolveSale, cancel: ports.cancelSale };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    expect(draft).toEqual({ cartId: "cart-keep", lines: 2 });
    expect(controller.getSession().stage).toBe("resolving_sale");
    expect(controller.getSession().saleCompleted).toBe(false);
  });

  test("prepared cash checkout cannot be dismissed back to idle", async () => {
    const ports = spyPorts();
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    expect(controller.getSession().stage).toBe("choose_payment");
    controller.dismiss();
    expect(controller.getSession().stage).toBe("choose_payment");
    expect(controller.getSession().prepared?.transactionId).toBe(TX);
  });

  test("prepared cash checkout cannot expose or start New Sale", async () => {
    const ports = spyPorts();
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    expect(canBeginNewSale(controller.getSession())).toBe(false);
    controller.resetForNewSale();
    expect(controller.getSession().stage).toBe("choose_payment");
    expect(controller.getSession().prepared?.transactionId).toBe(TX);
    expect(ports.prepare).toHaveBeenCalledTimes(1);
  });

  test("cash failure after a prepared sale cannot be dismissed into an editable cart", async () => {
    const ports = spyPorts();
    ports.confirmCash.mockResolvedValue(success(failedPayment()));
    ports.payments = { confirmCash: ports.confirmCash, resolve: ports.resolvePayment };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    controller.selectCash();
    await controller.confirmCash("20.00");
    expect(controller.getSession().stage).toBe("cash_failed");
    controller.dismiss();
    controller.resetForNewSale();
    expect(controller.getSession().stage).toBe("cash_failed");
    expect(canBeginNewSale(controller.getSession())).toBe(false);
    expect(controller.getSession().prepared?.transactionId).toBe(TX);
  });

  test("retry after cash failure continues on the original transaction and cash idempotency identity", async () => {
    const ports = spyPorts();
    ports.confirmCash
      .mockResolvedValueOnce(success(failedPayment()))
      .mockResolvedValueOnce(success(verifiedPayment()));
    ports.payments = { confirmCash: ports.confirmCash, resolve: ports.resolvePayment };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    controller.selectCash();
    await controller.confirmCash("20.00");
    expect(controller.getSession().stage).toBe("cash_failed");
    await controller.confirmCash("20.00");
    expect(ports.confirmCash).toHaveBeenCalledTimes(2);
    expect(ports.confirmCash.mock.calls[0]?.[0].transactionId).toBe(TX);
    expect(ports.confirmCash.mock.calls[1]?.[0].transactionId).toBe(TX);
    expect(ports.confirmCash.mock.calls[0]?.[1]).toEqual({
      idempotencyKey: CASH_KEY,
      correlationId: CASH_CORR,
    });
    expect(ports.confirmCash.mock.calls[1]?.[1]).toEqual({
      idempotencyKey: CASH_KEY,
      correlationId: CASH_CORR,
    });
    expect(ports.prepare).toHaveBeenCalledTimes(1);
  });

  test("a changed cart cannot create a new checkout transaction while the prepared sale is outstanding", async () => {
    const ports = spyPorts();
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    const changedQuote = { ...quoteFixture(), id: "quote-live-2", fingerprint: "fp-live-2", cartRevision: 2 };
    await controller.startPrepare(changedQuote);
    expect(ports.prepare).toHaveBeenCalledTimes(1);
    expect(ports.prepare.mock.calls[0]?.[0].transactionId).toBe(TX);
    expect(controller.getSession().stage).toBe("choose_payment");
    expect(controller.getSession().transactionId).toBe(TX);
  });

  test("prepare_failed without a confirmed prepared sale can return safely to the Sell workspace", async () => {
    const ports = spyPorts();
    ports.prepare.mockResolvedValue(failure("retry_same_key", "Stock changed"));
    ports.checkout = { prepare: ports.prepare, finalize: ports.finalize };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    expect(controller.getSession().stage).toBe("prepare_failed");
    expect(controller.getSession().prepared).toBeUndefined();
    expect(canBeginNewSale(controller.getSession())).toBe(true);
    controller.dismiss();
    expect(controller.getSession().stage).toBe("idle");
    expect(controller.getSession().transactionId).toBeUndefined();
  });

  test("payment_pending resolution checks the existing tender instead of confirming cash again", async () => {
    const ports = spyPorts();
    ports.prepare.mockRejectedValue(new Error("timeout"));
    ports.resolveSale.mockResolvedValue(
      success({
        transactionId: TX,
        status: "payment_pending",
        paymentId: PAYMENT,
        saleId: "sale-1",
      }),
    );
    ports.resolvePayment.mockResolvedValue(success(pendingPayment()));
    ports.checkout = { prepare: ports.prepare, finalize: ports.finalize };
    ports.sales = { resolve: ports.resolveSale, cancel: ports.cancelSale };
    ports.payments = { confirmCash: ports.confirmCash, resolve: ports.resolvePayment };
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    expect(controller.getSession().stage).toBe("resolving_payment");
    expect(ports.confirmCash).not.toHaveBeenCalled();
    expect(ports.resolvePayment).toHaveBeenCalledTimes(1);
    expect(ports.resolvePayment).toHaveBeenCalledWith({ transactionId: TX, paymentId: PAYMENT });
    await controller.confirmCash("20.00");
    expect(ports.confirmCash).not.toHaveBeenCalled();
    expect(canBeginNewSale(controller.getSession())).toBe(false);
  });

  test("15. Existing FE-03 barcode/customer/cart behavior remains intact", () => {
    const deps = { createCartId: () => "cart-screen", createLineId: () => "line-screen" };
    let state = createSellWorkspace(deps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345678901", SELL_TEST_CATALOG, deps);
    expect(state.lines[0]?.name).toMatch(/Hardener|Epoxy/i);
    expect(state.cartRevision).toBe(1);
  });

  test("16. Existing FE-04 quote/revision/cart-identity behavior remains intact", () => {
    const presented = resolveQuotePresentation({
      quote: { status: "confirmed", revision: 1, quote: { total: { minor: 2500, currency: "GHS" } } },
      eligibility: { allowed: true },
      cartRevision: 2,
    });
    expect(presented.quote?.status).toBe("stale");
    expect(presented.eligibility?.allowed).toBe(false);
    const previous = previousConfirmedQuoteForRequest(
      {
        cartId: "cart-a",
        revision: 4,
        state: { status: "confirmed", revision: 4, quote: quoteFixture() },
      },
      "cart-b",
      1,
    );
    expect(previous).toEqual({ status: "missing" });
  });

  test("UX-03 prepare opens choose_payment and cash/back do not re-prepare", async () => {
    const ports = spyPorts();
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    expect(controller.getSession().stage).toBe("choose_payment");
    expect(controller.getSession().prepared?.orderReference).toBe("POS-1001");
    expect(controller.getSession().prepared?.total).toEqual({ minor: 1500, currency: "GHS" });
    const transactionId = controller.getSession().transactionId;
    controller.selectCash();
    expect(controller.getSession().stage).toBe("cash");
    controller.backToPaymentChoice();
    expect(controller.getSession().stage).toBe("choose_payment");
    expect(controller.getSession().transactionId).toBe(transactionId);
    expect(ports.prepare).toHaveBeenCalledTimes(1);
    controller.selectCash();
    expect(ports.prepare).toHaveBeenCalledTimes(1);
  });

  test("UX-03 cancel prepared sale uses a stable cancel identity and returns to idle", async () => {
    const ports = spyPorts();
    const controller = createCashCheckoutController(ports);
    await controller.startPrepare(quoteFixture());
    await controller.cancelPreparedSale();
    expect(ports.cancelSale).toHaveBeenCalledTimes(1);
    expect(ports.cancelSale.mock.calls[0]?.[0]).toEqual({
      transactionId: TX,
      reason: "cashier_cancelled_prepared_sale",
    });
    const firstContext = ports.cancelSale.mock.calls[0]?.[1];
    expect(controller.getSession().stage).toBe("idle");
    expect(controller.getSession().prepared).toBeUndefined();
    await controller.startPrepare(quoteFixture());
    expect(ports.prepare).toHaveBeenCalledTimes(2);
    await controller.cancelPreparedSale();
    expect(ports.cancelSale.mock.calls[1]?.[1]).not.toEqual(firstContext);
  });
});
