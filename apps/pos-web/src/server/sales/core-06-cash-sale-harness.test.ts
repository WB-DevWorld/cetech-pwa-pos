import { describe, expect, test } from "vitest";
import type { Quote, QuoteRequest } from "../../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../config/auth";
import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import type { CheckoutStore } from "../../core/checkout/types";
import { createMemoryCatalogPresentationLookup } from "../../core/receipt/catalog-presentation";
import { createMemoryReceiptSettingsStore } from "../../core/receipt/settings-store";
import { createMemoryAssignmentDirectory } from "../auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../auth/session-store";
import { createCashCheckoutController } from "../../features/sell/runtime/cashCheckoutController";
import { handleConfirmCash } from "./handle-confirm-cash";
import { handleFinalizeSale } from "./handle-finalize-sale";
import { handleGetReceipt } from "./handle-get-receipt";
import { handleOpenShift } from "./handle-open-shift";
import { handlePrepareSale } from "./handle-prepare-sale";
import { handleQuote } from "../quotes/handle-quote";
import { handleResolvePayment } from "./handle-resolve-payment";
import { handleResolveSale } from "./handle-resolve-sale";
import { createInstrumentedBridgeSalesPort } from "./instrumented-bridge-sales-port";

const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ORIGIN = "https://pos.example.test";
const CSRF = "csrf-core06-token";
const NOW = new Date("2026-09-15T12:00:00.000Z");
const DEVICE_ID = "44444444-4444-4444-8444-444444444444";
const TX_A = "11111111-1111-4111-8111-111111111111";
const PREPARE_KEY = "22222222-2222-4222-8222-222222222222";
const PREPARE_KEY_2 = "22222222-2222-4222-8222-222222222223";
const CASH_KEY = "33333333-3333-4333-8333-333333333333";
const FINALIZE_KEY = "55555555-5555-4555-8555-555555555555";
const OPEN_KEY = "66666666-6666-4666-8666-666666666666";
const RETAIL_FP = "0123456789abcdef0123456789abcdef";
const B2B_FP = "abcdef0123456789abcdef0123456789";
const CART_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LINE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function cashierAssignments() {
  return createMemoryAssignmentDirectory([
    {
      actorId: "cashier_a",
      organizationId: "org_a",
      locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
      registerIds: ["reg_a1"],
    },
  ]);
}

function ghs(minor: number) {
  return { minor, currency: "GHS" as const };
}

function quoteRequest(customer: QuoteRequest["customer"]): QuoteRequest {
  return {
    cartId: CART_ID,
    cartRevision: 1,
    customer,
    locationId: "loc_a1",
    lines: [{ lineId: LINE_ID, productId: "p-hardener", quantity: "1" }],
  };
}

function quoteFromRequest(request: QuoteRequest): Quote {
  const b2b = request.customer.kind === "b2b";
  const total = ghs(b2b ? 1200 : 1500);
  const zero = ghs(0);
  return {
    id: b2b ? "quote-b2b-1" : "quote-retail-1",
    fingerprint: b2b ? B2B_FP : RETAIL_FP,
    cartId: request.cartId,
    cartRevision: request.cartRevision,
    customer: request.customer,
    locationId: request.locationId,
    currency: "GHS",
    lines: [
      {
        lineId: request.lines[0]!.lineId,
        productId: request.lines[0]!.productId,
        quantity: request.lines[0]!.quantity,
        unitPrice: total,
        subtotal: total,
        discount: zero,
        tax: zero,
        total,
        stockStatus: "in_stock",
        purchasable: true,
        problems: [],
      },
    ],
    subtotal: total,
    discount: zero,
    tax: zero,
    total,
    calculatedAt: "2026-09-15T12:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    purchasable: true,
  };
}

async function staffCookies() {
  const store = createEphemeralInMemoryStaffSessionStore();
  const sessionId = await store.create(
    {
      actorId: "cashier_a",
      displayName: "Cashier A",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
      capabilities: ["ui.hint.only"],
      expiresAt: "2026-09-15T22:00:00.000Z",
    },
    CSRF,
    new Date("2026-09-15T22:00:00.000Z"),
  );
  return {
    store,
    cookieHeader: `${STAFF_SESSION_COOKIE}=${sessionId}; ${STAFF_CSRF_COOKIE}=${CSRF}`,
  };
}

async function seedRegister(store: CheckoutStore) {
  await store.seedRegister({
    id: "reg_a1",
    name: "Register 1",
    locationId: "loc_a1",
    currency: "GHS",
    status: "active",
    organizationId: "org_a",
  });
  await store.seedDevice({
    id: DEVICE_ID,
    organizationId: "org_a",
    locationId: "loc_a1",
    status: "active",
  });
}

async function openRegister(checkoutStore: CheckoutStore) {
  const { store, cookieHeader } = await staffCookies();
  const opened = await handleOpenShift({
    correlationIdHeader: CORRELATION,
    origin: ORIGIN,
    referer: null,
    csrfHeader: CSRF,
    cookieHeader,
    idempotencyKeyHeader: OPEN_KEY,
    body: { registerId: "reg_a1", deviceId: DEVICE_ID, openingFloat: ghs(10000) },
    now: NOW,
    sessionStore: store,
    allowedOrigins: [ORIGIN],
    checkoutStore,
    assignments: cashierAssignments(),
  });
  expect(opened.body.ok).toBe(true);
  if (!opened.body.ok) {
    throw new Error("expected open shift");
  }
  return { sessionStore: store, cookieHeader, shift: opened.body.data };
}

async function setupSale(customer: QuoteRequest["customer"] = { kind: "walkin" }) {
  const checkoutStore = createInMemoryCheckoutStore();
  await seedRegister(checkoutStore);
  const opened = await openRegister(checkoutStore);
  const salesPort = createInstrumentedBridgeSalesPort();
  const quoted = await handleQuote({
    correlationIdHeader: CORRELATION,
    origin: ORIGIN,
    referer: null,
    csrfHeader: CSRF,
    cookieHeader: opened.cookieHeader,
    body: quoteRequest(customer),
    now: NOW,
    sessionStore: opened.sessionStore,
    allowedOrigins: [ORIGIN],
    snapshots: checkoutStore,
    bridge: {
      async postQuote(request, correlationId) {
        const quote = quoteFromRequest(request);
        salesPort.quotes.set(quote.id, quote);
        return { ok: true, data: quote, correlationId };
      },
    },
  });
  expect(quoted.body.ok).toBe(true);
  if (!quoted.body.ok) {
    throw new Error("expected quote");
  }
  return { checkoutStore, opened, salesPort, quote: quoted.body.data };
}

function headers(opened: { cookieHeader: string; sessionStore: Awaited<ReturnType<typeof staffCookies>>["store"] }) {
  const catalogLookup = createMemoryCatalogPresentationLookup({
    org_a: [{ id: "p-hardener", name: "Epoxy Hardener 1L", sku: "HDN-1L", kind: "simple" }],
  });
  const receiptSettings = createMemoryReceiptSettingsStore();
  return {
    correlationIdHeader: CORRELATION,
    origin: ORIGIN,
    referer: null as string | null,
    csrfHeader: CSRF,
    cookieHeader: opened.cookieHeader,
    now: NOW,
    sessionStore: opened.sessionStore,
    allowedOrigins: [ORIGIN],
    assignments: cashierAssignments(),
    catalogLookup,
    receiptSettings,
  };
}

describe("CORE-06 combined cash-sale harness", () => {
  test("retail walk-in quote/prepare/cash/finalize yields one order, tender, stock effect, receipt and POS transaction", async () => {
    const { checkoutStore, opened, salesPort, quote } = await setupSale({ kind: "walkin" });
    const env = headers(opened);
    const prepared = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY,
      body: {
        transactionId: TX_A,
        registerId: "reg_a1",
        shiftId: opened.shift.id,
        deviceId: DEVICE_ID,
        quoteId: quote.id,
        quoteFingerprint: quote.fingerprint,
      },
    });
    expect(prepared.body.ok).toBe(true);
    if (!prepared.body.ok) {
      throw new Error("expected prepare");
    }
    expect(prepared.body.data.total).toEqual(ghs(1500));
    expect(salesPort.wooOrderCount).toBe(1);
    expect(salesPort.stockReserveCount).toBe(1);

    const cash = await handleConfirmCash({
      ...env,
      checkoutStore,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(2000) },
    });
    expect(cash.body.ok).toBe(true);
    if (!cash.body.ok) {
      throw new Error("expected cash");
    }

    const finalized = await handleFinalizeSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_A, paymentId: cash.body.data.paymentId },
    });
    expect(finalized.body.ok).toBe(true);
    if (!finalized.body.ok) {
      throw new Error("expected finalize");
    }
    expect(finalized.body.data.status).toBe("completed");
    expect(salesPort.wooOrderCount).toBe(1);
    expect(salesPort.paymentCompleteCount).toBe(1);
    expect(salesPort.stockEffectCount).toBe(1);
    expect(await checkoutStore.listCashSales(TX_A)).toHaveLength(1);

    const receipt = await handleGetReceipt({
      ...env,
      checkoutStore,
      transactionId: TX_A,
    });
    expect(receipt.body.ok).toBe(true);
    if (!receipt.body.ok) {
      throw new Error("expected receipt");
    }
    expect(receipt.body.data.orderReference).toBe(prepared.body.data.orderReference);
    expect(receipt.body.data.total).toEqual(ghs(1500));
    expect(receipt.body.data.customerLabel).toBe("Walk-in");
    expect(receipt.body.data.documentKind).toBe("operational_pos_receipt");
    expect(receipt.body.data.lines[0]?.name).toBe("Epoxy Hardener 1L");
    expect(receipt.body.data.lines[0]?.displayName).toBe("Epoxy Hardener 1L");
    expect(receipt.body.data.lines[0]?.sku).toBeUndefined();
    expect(receipt.body.data.lines[0]?.name).not.toBe("p-hardener");

    const resolved = await handleResolveSale({
      ...env,
      checkoutStore,
      salesPort,
      transactionId: TX_A,
    });
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("completed");
      expect(resolved.body.data.receiptId).toBe(receipt.body.data.id);
      expect(resolved.body.data.saleId).toBe(prepared.body.data.saleId);
    }
  });

  test("B2B cash sale consumes the authoritative quoted total rather than a frontend price", async () => {
    const { checkoutStore, opened, salesPort, quote } = await setupSale({
      kind: "b2b",
      customerId: "cust-buildworks",
    });
    expect(quote.total).toEqual(ghs(1200));
    expect(quote.fingerprint).toBe(B2B_FP);
    const env = headers(opened);
    const prepared = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY,
      body: {
        transactionId: TX_A,
        registerId: "reg_a1",
        shiftId: opened.shift.id,
        deviceId: DEVICE_ID,
        quoteId: quote.id,
        quoteFingerprint: quote.fingerprint,
      },
    });
    expect(prepared.body.ok).toBe(true);
    if (!prepared.body.ok) {
      throw new Error("expected b2b prepare");
    }
    expect(prepared.body.data.total).toEqual(ghs(1200));
    const cash = await handleConfirmCash({
      ...env,
      checkoutStore,
      idempotencyKeyHeader: CASH_KEY,
      body: { transactionId: TX_A, cashReceived: ghs(1200) },
    });
    expect(cash.body.ok).toBe(true);
    if (!cash.body.ok) {
      throw new Error("expected b2b cash");
    }
    const finalized = await handleFinalizeSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: { transactionId: TX_A, paymentId: cash.body.data.paymentId },
    });
    expect(finalized.body.ok).toBe(true);
    if (finalized.body.ok) {
      expect(finalized.body.data.status).toBe("completed");
    }
    const receipt = await handleGetReceipt({ ...env, checkoutStore, transactionId: TX_A });
    expect(receipt.body.ok).toBe(true);
    if (receipt.body.ok) {
      expect(receipt.body.data.total).toEqual(ghs(1200));
      expect(receipt.body.data.customerLabel).toBe("cust-buildworks");
    }
    expect(salesPort.wooOrderCount).toBe(1);
    expect(salesPort.stockEffectCount).toBe(1);
  });

  test("duplicate prepare with the same key reuses one Woo order", async () => {
    const { checkoutStore, opened, salesPort, quote } = await setupSale();
    const env = headers(opened);
    const body = {
      transactionId: TX_A,
      registerId: "reg_a1",
      shiftId: opened.shift.id,
      deviceId: DEVICE_ID,
      quoteId: quote.id,
      quoteFingerprint: quote.fingerprint,
    };
    const first = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY,
      body,
    });
    const second = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY,
      body,
    });
    expect(first.body.ok && second.body.ok).toBe(true);
    if (first.body.ok && second.body.ok) {
      expect(second.body.data.saleId).toBe(first.body.data.saleId);
      expect(second.body.data.orderReference).toBe(first.body.data.orderReference);
    }
    expect(salesPort.wooOrderCount).toBe(1);
    expect(salesPort.stockReserveCount).toBe(1);
  });

  test("same key with a different prepare request is an idempotency conflict", async () => {
    const { checkoutStore, opened, salesPort, quote } = await setupSale();
    const env = headers(opened);
    const first = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY,
      body: {
        transactionId: TX_A,
        registerId: "reg_a1",
        shiftId: opened.shift.id,
        deviceId: DEVICE_ID,
        quoteId: quote.id,
        quoteFingerprint: quote.fingerprint,
      },
    });
    expect(first.body.ok).toBe(true);
    const conflict = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY,
      body: {
        transactionId: "11111111-1111-4111-8111-111111111112",
        registerId: "reg_a1",
        shiftId: opened.shift.id,
        deviceId: DEVICE_ID,
        quoteId: quote.id,
        quoteFingerprint: quote.fingerprint,
      },
    });
    expect(conflict.body.ok).toBe(false);
    if (!conflict.body.ok) {
      expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
    }
    expect(salesPort.wooOrderCount).toBe(1);
  });

  test("lost prepare response recovers the existing Woo order instead of creating a second", async () => {
    const { checkoutStore, opened, salesPort, quote } = await setupSale();
    const env = headers(opened);
    const body = {
      transactionId: TX_A,
      registerId: "reg_a1",
      shiftId: opened.shift.id,
      deviceId: DEVICE_ID,
      quoteId: quote.id,
      quoteFingerprint: quote.fingerprint,
    };
    salesPort.dropNextPrepareResponse = true;
    const lost = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY,
      body,
    });
    expect(lost.body.ok).toBe(true);
    if (!lost.body.ok) {
      throw new Error("expected recovered prepare");
    }
    expect(salesPort.wooOrderCount).toBe(1);
    const replay = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY,
      body,
    });
    expect(replay.body.ok).toBe(true);
    if (replay.body.ok) {
      expect(replay.body.data.saleId).toBe(lost.body.data.saleId);
    }
    expect(salesPort.wooOrderCount).toBe(1);
    const resolved = await handleResolveSale({
      ...env,
      checkoutStore,
      salesPort,
      transactionId: TX_A,
    });
    expect(resolved.body.ok).toBe(true);
    if (resolved.body.ok) {
      expect(resolved.body.data.status).toBe("prepared");
      expect(resolved.body.data.saleId).toBe(lost.body.data.saleId);
    }
  });

  test("duplicate cash confirmation is one ledger row; duplicate finalize is one commercial stock effect", async () => {
    const { checkoutStore, opened, salesPort, quote } = await setupSale();
    const env = headers(opened);
    const prepared = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY,
      body: {
        transactionId: TX_A,
        registerId: "reg_a1",
        shiftId: opened.shift.id,
        deviceId: DEVICE_ID,
        quoteId: quote.id,
        quoteFingerprint: quote.fingerprint,
      },
    });
    expect(prepared.body.ok).toBe(true);
    const cashBody = { transactionId: TX_A, cashReceived: ghs(2000) };
    const firstCash = await handleConfirmCash({
      ...env,
      checkoutStore,
      idempotencyKeyHeader: CASH_KEY,
      body: cashBody,
    });
    const secondCash = await handleConfirmCash({
      ...env,
      checkoutStore,
      idempotencyKeyHeader: CASH_KEY,
      body: cashBody,
    });
    expect(firstCash.body.ok && secondCash.body.ok).toBe(true);
    if (firstCash.body.ok && secondCash.body.ok) {
      expect(secondCash.body.data.paymentId).toBe(firstCash.body.data.paymentId);
    }
    expect(await checkoutStore.listCashSales(TX_A)).toHaveLength(1);
    if (!firstCash.body.ok) {
      throw new Error("expected cash");
    }
    const finalizeBody = { transactionId: TX_A, paymentId: firstCash.body.data.paymentId };
    const firstFinalize = await handleFinalizeSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: finalizeBody,
    });
    const secondFinalize = await handleFinalizeSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: FINALIZE_KEY,
      body: finalizeBody,
    });
    expect(firstFinalize.body.ok && secondFinalize.body.ok).toBe(true);
    if (firstFinalize.body.ok && secondFinalize.body.ok) {
      expect(secondFinalize.body.data.receiptId).toBe(firstFinalize.body.data.receiptId);
      expect(secondFinalize.body.data.status).toBe("completed");
    }
    expect(salesPort.paymentCompleteCount).toBe(1);
    expect(salesPort.stockEffectCount).toBe(1);
    expect(salesPort.wooOrderCount).toBe(1);
    const again = await handleGetReceipt({ ...env, checkoutStore, transactionId: TX_A });
    expect(again.body.ok).toBe(true);
    if (again.body.ok && firstFinalize.body.ok) {
      expect(again.body.data.id).toBe(firstFinalize.body.data.receiptId);
    }
  });

  test("FE controller plus BFF handlers recover a lost prepare response without a second sale", async () => {
    const { checkoutStore, opened, salesPort, quote } = await setupSale();
    const env = headers(opened);
    let dropClient = true;
    const controller = createCashCheckoutController({
      scope: { registerId: "reg_a1", shiftId: opened.shift.id, deviceId: DEVICE_ID },
      createUuid: (() => {
        const ids = [
          TX_A,
          PREPARE_KEY,
          "77777777-7777-4777-8777-777777777771",
          CASH_KEY,
          "77777777-7777-4777-8777-777777777772",
          FINALIZE_KEY,
          "77777777-7777-4777-8777-777777777773",
        ];
        let index = 0;
        return () => ids[index++] ?? crypto.randomUUID();
      })(),
      checkout: {
        async prepare(input, context) {
          const result = await handlePrepareSale({
            ...env,
            checkoutStore,
            salesPort,
            idempotencyKeyHeader: context.idempotencyKey,
            correlationIdHeader: context.correlationId,
            body: input,
          });
          if (dropClient) {
            dropClient = false;
            throw new Error("lost BFF prepare response");
          }
          return result.body;
        },
        async finalize(input, context) {
          const result = await handleFinalizeSale({
            ...env,
            checkoutStore,
            salesPort,
            idempotencyKeyHeader: context.idempotencyKey,
            correlationIdHeader: context.correlationId,
            body: input,
          });
          return result.body;
        },
      },
      payments: {
        async confirmCash(input, context) {
          const result = await handleConfirmCash({
            ...env,
            checkoutStore,
            idempotencyKeyHeader: context.idempotencyKey,
            correlationIdHeader: context.correlationId,
            body: input,
          });
          return result.body;
        },
        async resolve(input) {
          const result = await handleResolvePayment({
            ...env,
            checkoutStore,
            body: input,
          });
          return result.body;
        },
      },
      sales: {
        async resolve(transactionId) {
          const result = await handleResolveSale({
            ...env,
            checkoutStore,
            salesPort,
            transactionId,
          });
          return result.body;
        },
      },
      receipts: {
        async getByTransaction(id) {
          const result = await handleGetReceipt({ ...env, checkoutStore, transactionId: id });
          return result.body;
        },
      },
      printer: {
        async print() {
          return { status: "dialog_opened", message: "Print dialog opened." };
        },
      },
    });

    await controller.startPrepare(quote);
    expect(controller.getSession().stage).toBe("cash");
    expect(salesPort.wooOrderCount).toBe(1);
    await controller.confirmCash("20.00");
    expect(controller.getSession().stage).toBe("receipt_ready");
    expect(controller.getSession().receipt?.orderReference).toBe("woo-1");
    expect(salesPort.wooOrderCount).toBe(1);
    expect(salesPort.paymentCompleteCount).toBe(1);
    expect(salesPort.stockEffectCount).toBe(1);
    expect(await checkoutStore.listCashSales(TX_A)).toHaveLength(1);

    const recovered = await handleGetReceipt({ ...env, checkoutStore, transactionId: TX_A });
    expect(recovered.body.ok).toBe(true);
    if (recovered.body.ok) {
      expect(recovered.body.data.id).toBe(controller.getSession().receipt?.id);
    }
  });

  test("a second prepare key for the same already-prepared transaction does not create another Woo order", async () => {
    const { checkoutStore, opened, salesPort, quote } = await setupSale();
    const env = headers(opened);
    const body = {
      transactionId: TX_A,
      registerId: "reg_a1",
      shiftId: opened.shift.id,
      deviceId: DEVICE_ID,
      quoteId: quote.id,
      quoteFingerprint: quote.fingerprint,
    };
    const first = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY,
      body,
    });
    const second = await handlePrepareSale({
      ...env,
      checkoutStore,
      salesPort,
      idempotencyKeyHeader: PREPARE_KEY_2,
      body,
    });
    expect(first.body.ok && second.body.ok).toBe(true);
    if (first.body.ok && second.body.ok) {
      expect(second.body.data.saleId).toBe(first.body.data.saleId);
    }
    expect(salesPort.wooOrderCount).toBe(1);
  });
});
