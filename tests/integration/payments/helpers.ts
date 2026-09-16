import type { CustomerContext, Money, PreparedSale, ReceiptLine } from "../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../../apps/pos-web/src/config/auth";
import { createInMemoryCheckoutStore } from "../../../apps/pos-web/src/core/checkout/in-memory-store";
import type { CheckoutStore } from "../../../apps/pos-web/src/core/checkout/types";
import { createMemoryAssignmentDirectory } from "../../../apps/pos-web/src/server/auth/assignments";
import { createEphemeralInMemoryStaffSessionStore } from "../../../apps/pos-web/src/server/auth/session-store";
import { createFakeElectronicPaymentProvider } from "../../../apps/pos-web/src/server/payments/fake-provider";
import { handleInitializePayment } from "../../../apps/pos-web/src/server/payments/handle-initialize-payment";
import { handlePaystackWebhook } from "../../../apps/pos-web/src/server/payments/handle-paystack-webhook";
import { handleConfirmCash } from "../../../apps/pos-web/src/server/sales/handle-confirm-cash";
import { handleFinalizeSale } from "../../../apps/pos-web/src/server/sales/handle-finalize-sale";
import { handleGetReceipt } from "../../../apps/pos-web/src/server/sales/handle-get-receipt";
import { handleOpenShift } from "../../../apps/pos-web/src/server/sales/handle-open-shift";
import { handleResolvePayment } from "../../../apps/pos-web/src/server/sales/handle-resolve-payment";
import { createInstrumentedBridgeSalesPort } from "../../../apps/pos-web/src/server/sales/instrumented-bridge-sales-port";

export const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
export const ORIGIN = "https://pos.example.test";
export const CSRF = "csrf-pay01-token";
export const NOW = new Date("2026-09-15T14:00:00.000Z");
export const DEVICE_ID = "44444444-4444-4444-8444-444444444444";
export const TX_A = "11111111-1111-4111-8111-111111111111";
export const INIT_KEY = "22222222-2222-4222-8222-222222222201";
export const INIT_KEY_2 = "22222222-2222-4222-8222-222222222202";
export const FINALIZE_KEY = "33333333-3333-4333-8333-333333333301";
export const OPEN_KEY = "55555555-5555-4555-8555-555555555501";
export const FINGERPRINT = "0123456789abcdef0123456789abcdef";
export const SANDBOX_EMAIL = "pos-sandbox@example.invalid";

export function ghs(minor: number): Money {
  return { minor, currency: "GHS" };
}

export function cashierAssignments(registerIds: readonly string[] = ["reg_a1"]) {
  return createMemoryAssignmentDirectory([
    {
      actorId: "cashier_a",
      organizationId: "org_a",
      locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
      registerIds,
    },
    {
      actorId: "cashier_b",
      organizationId: "org_b",
      locationRoles: [{ locationId: "loc_b1", role: "cashier" }],
      registerIds: ["reg_b1"],
    },
  ]);
}

export async function staffCookies(input?: { readonly actorId?: string; readonly organizationId?: string; readonly locationIds?: readonly string[] }) {
  const store = createEphemeralInMemoryStaffSessionStore();
  const sessionId = await store.create(
    {
      actorId: input?.actorId ?? "cashier_a",
      displayName: "Cashier",
      organizationId: input?.organizationId ?? "org_a",
      locationIds: [...(input?.locationIds ?? ["loc_a1"])],
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

function line(total: Money): ReceiptLine {
  return {
    name: "Hardener",
    quantity: "1",
    unitPrice: total,
    subtotal: total,
    discount: ghs(0),
    tax: ghs(0),
    total,
  };
}

function prepared(transactionId: string, total: Money, saleId: string): PreparedSale {
  return {
    transactionId,
    saleId,
    orderReference: saleId,
    quoteFingerprint: FINGERPRINT,
    total,
    status: "prepared",
    stockCommitment: "reserved",
    preparedAt: "2026-09-15T13:00:00.000Z",
    expiresAt: "2026-09-15T18:00:00.000Z",
  };
}

export async function seedRegister(store: CheckoutStore, input?: { readonly organizationId?: string; readonly locationId?: string; readonly registerId?: string }) {
  await store.seedRegister({
    id: input?.registerId ?? "reg_a1",
    name: "Register 1",
    locationId: input?.locationId ?? "loc_a1",
    currency: "GHS",
    status: "active",
    organizationId: input?.organizationId ?? "org_a",
  });
  await store.seedDevice({
    id: DEVICE_ID,
    organizationId: input?.organizationId ?? "org_a",
    locationId: input?.locationId ?? "loc_a1",
    status: "active",
  });
}

export async function seedSale(
  store: CheckoutStore,
  input: {
    transactionId: string;
    saleId: string;
    total: Money;
    shiftId: string;
    customer?: CustomerContext;
    organizationId?: string;
    locationId?: string;
    registerId?: string;
    status?: "prepared" | "cancelled" | "completed";
  },
) {
  const record = await store.seedPreparedSale({
    organizationId: input.organizationId ?? "org_a",
    locationId: input.locationId ?? "loc_a1",
    locationName: "Accra Store",
    registerId: input.registerId ?? "reg_a1",
    registerName: "Register 1",
    deviceId: DEVICE_ID,
    shiftId: input.shiftId,
    cashierId: "cashier_a",
    cashierName: "Cashier A",
    customer: input.customer ?? { kind: "walkin" },
    customerLabel: "Walk-in",
    prepared: prepared(input.transactionId, input.total, input.saleId),
    lines: [line(input.total)],
    subtotal: input.total,
    discount: ghs(0),
    tax: ghs(0),
  });
  if (input.status && input.status !== "prepared") {
    await store.saveSale({ ...record, status: input.status });
  }
}

export async function openRegister(checkoutStore: CheckoutStore) {
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
  if (!opened.body.ok) {
    throw new Error("open shift failed");
  }
  return opened.body.data.id;
}

export function commandBase(cookieHeader: string) {
  return {
    correlationIdHeader: CORRELATION,
    origin: ORIGIN,
    referer: null as string | null,
    csrfHeader: CSRF,
    cookieHeader,
    now: NOW,
    allowedOrigins: [ORIGIN],
    assignments: cashierAssignments(),
  };
}

export async function createPay01Runtime() {
  const checkoutStore = createInMemoryCheckoutStore();
  await seedRegister(checkoutStore);
  const shiftId = await openRegister(checkoutStore);
  await seedSale(checkoutStore, {
    transactionId: TX_A,
    saleId: "woo-pay01",
    total: ghs(2900),
    shiftId,
  });
  const sessions = await staffCookies();
  const provider = createFakeElectronicPaymentProvider();
  const salesPort = createInstrumentedBridgeSalesPort();
  const sale = await checkoutStore.getSale(TX_A);
  if (sale) {
    salesPort.seedPrepared(sale.prepared);
  }
  return { checkoutStore, shiftId, sessions, provider, salesPort };
}

export async function initializeCard(runtime: Awaited<ReturnType<typeof createPay01Runtime>>, key = INIT_KEY) {
  return handleInitializePayment({
    ...commandBase(runtime.sessions.cookieHeader),
    idempotencyKeyHeader: key,
    body: { transactionId: TX_A, tender: "card" },
    sessionStore: runtime.sessions.store,
    checkoutStore: runtime.checkoutStore,
    provider: runtime.provider,
    appEnv: "local",
    sandboxPayerEmail: SANDBOX_EMAIL,
    env: {},
  });
}

export async function resolvePayment(runtime: Awaited<ReturnType<typeof createPay01Runtime>>, paymentId?: string) {
  return handleResolvePayment({
    ...commandBase(runtime.sessions.cookieHeader),
    body: paymentId ? { transactionId: TX_A, paymentId } : { transactionId: TX_A },
    sessionStore: runtime.sessions.store,
    checkoutStore: runtime.checkoutStore,
    provider: runtime.provider,
  });
}

export async function webhook(runtime: Awaited<ReturnType<typeof createPay01Runtime>>, rawBody: string, signature?: string | null) {
  return handlePaystackWebhook({
    rawBody,
    signature: signature === undefined ? runtime.provider.sign(rawBody) : signature,
    now: NOW,
    checkoutStore: runtime.checkoutStore,
    provider: runtime.provider,
  });
}

export async function finalize(runtime: Awaited<ReturnType<typeof createPay01Runtime>>, paymentId: string, key = FINALIZE_KEY) {
  return handleFinalizeSale({
    ...commandBase(runtime.sessions.cookieHeader),
    idempotencyKeyHeader: key,
    body: { transactionId: TX_A, paymentId },
    sessionStore: runtime.sessions.store,
    checkoutStore: runtime.checkoutStore,
    salesPort: runtime.salesPort,
  });
}

export async function receipt(runtime: Awaited<ReturnType<typeof createPay01Runtime>>) {
  return handleGetReceipt({
    ...commandBase(runtime.sessions.cookieHeader),
    transactionId: TX_A,
    sessionStore: runtime.sessions.store,
    checkoutStore: runtime.checkoutStore,
  });
}

export async function confirmCash(runtime: Awaited<ReturnType<typeof createPay01Runtime>>, cashKey = "22222222-2222-4222-8222-222222222299") {
  return handleConfirmCash({
    ...commandBase(runtime.sessions.cookieHeader),
    idempotencyKeyHeader: cashKey,
    body: { transactionId: TX_A, cashReceived: ghs(3000) },
    sessionStore: runtime.sessions.store,
    checkoutStore: runtime.checkoutStore,
  });
}
