import type { Money, PreparedSale, Quantity, ReceiptLine, ReturnCondition } from "../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE, STAFF_SESSION_COOKIE } from "../../../apps/pos-web/src/config/auth";
import { createInMemoryCheckoutStore } from "../../../apps/pos-web/src/core/checkout/in-memory-store";
import type { CheckoutStore, StoredSaleOrderLine } from "../../../apps/pos-web/src/core/checkout/types";
import { createInMemoryReturnStore } from "../../../apps/pos-web/src/core/returns/in-memory-store";
import { createMemoryAssignmentDirectory } from "../../../apps/pos-web/src/server/auth/assignments";
import { createMemoryOperationalPolicyStore } from "../../../apps/pos-web/src/server/admin/operational-policy-store";
import { createEphemeralInMemoryStaffSessionStore } from "../../../apps/pos-web/src/server/auth/session-store";
import { createFakeElectronicRefundProvider } from "../../../apps/pos-web/src/server/payments/fake-refund-provider";
import { handleOpenShift } from "../../../apps/pos-web/src/server/sales/handle-open-shift";
import { createFakeBridgeReturnEffects } from "../../../apps/pos-web/src/server/returns/fake-bridge-return-effects";
import { handlePreviewReturn } from "../../../apps/pos-web/src/server/returns/handle-preview-return";
import { handleExecuteReturn } from "../../../apps/pos-web/src/server/returns/handle-execute-return";
import { handleResolveReturn } from "../../../apps/pos-web/src/server/returns/handle-resolve-return";
import { handleResolveRefund } from "../../../apps/pos-web/src/server/payments/handle-resolve-refund";
import { bindReturnApproval } from "../../../apps/pos-web/src/server/returns/approval";

export const CORRELATION = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
export const ORIGIN = "https://pos.example.test";
export const CSRF = "csrf-rt01-token";
export const NOW = new Date("2026-09-15T16:00:00.000Z");
export const DEVICE_ID = "44444444-4444-4444-8444-444444444444";
export const TX_A = "11111111-1111-4111-8111-111111111401";
export const LINE_1 = "cccccccc-cccc-4ccc-8ccc-cccccccccc01";
export const OPEN_KEY = "55555555-5555-4555-8555-555555555501";
export const FINGERPRINT = "0123456789abcdef0123456789abcdef";

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
      actorId: "manager_a",
      organizationId: "org_a",
      locationRoles: [{ locationId: "loc_a1", role: "manager" }],
      registerIds: ["reg_a1"],
    },
    {
      actorId: "cashier_b",
      organizationId: "org_b",
      locationRoles: [{ locationId: "loc_b1", role: "cashier" }],
      registerIds: ["reg_b1"],
    },
  ]);
}

export async function staffCookies(input?: {
  readonly actorId?: string;
  readonly displayName?: string;
  readonly organizationId?: string;
  readonly locationIds?: readonly string[];
}) {
  const store = createEphemeralInMemoryStaffSessionStore();
  const sessionId = await store.create(
    {
      actorId: input?.actorId ?? "cashier_a",
      displayName: input?.displayName ?? "Cashier A",
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

function receiptLine(name: string, quantity: Quantity, total: Money): ReceiptLine {
  return {
    name,
    quantity,
    unitPrice: total,
    subtotal: total,
    discount: ghs(0),
    tax: ghs(0),
    total,
  };
}

function prepared(transactionId: string, saleId: string, total: Money): PreparedSale {
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

export async function seedRegister(
  store: CheckoutStore,
  input?: { readonly organizationId?: string; readonly locationId?: string; readonly registerId?: string },
) {
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

export async function seedCompletedSale(
  store: CheckoutStore,
  input: {
    readonly transactionId: string;
    readonly saleId: string;
    readonly shiftId: string;
    readonly quantity?: Quantity;
    readonly lineTotal?: Money;
    readonly tender?: "cash" | "card";
    readonly currentCatalogPrice?: Money;
  },
) {
  const quantity = input.quantity ?? "2";
  const lineTotal = input.lineTotal ?? ghs(3000);
  const orderLines: readonly StoredSaleOrderLine[] = [
    {
      orderLineId: LINE_1,
      quantity,
      subtotal: lineTotal,
      discount: ghs(0),
      tax: ghs(0),
      total: lineTotal,
    },
  ];
  const record = await store.seedPreparedSale({
    organizationId: "org_a",
    locationId: "loc_a1",
    locationName: "Accra Store",
    registerId: "reg_a1",
    registerName: "Register 1",
    deviceId: DEVICE_ID,
    shiftId: input.shiftId,
    cashierId: "cashier_a",
    cashierName: "Cashier A",
    customer: { kind: "walkin" },
    customerLabel: "Walk-in",
    prepared: prepared(input.transactionId, input.saleId, lineTotal),
    lines: [receiptLine("Hardener", quantity, input.currentCatalogPrice ?? lineTotal)],
    orderLines,
    quoteId: "quote-historic-1",
    subtotal: lineTotal,
    discount: ghs(0),
    tax: ghs(0),
  });
  const paymentId = "22222222-2222-4222-8222-222222222401";
  await store.savePayment({
    paymentId,
    transactionId: input.transactionId,
    saleId: input.saleId,
    evidenceId: "33333333-3333-4333-8333-333333333401",
    tender: input.tender ?? "cash",
    status: "verified",
    amount: lineTotal,
    verifiedAt: "2026-09-15T15:00:00.000Z",
    verificationSource: input.tender === "card" ? "provider_server_verification" : "cash_ledger",
    actorId: "cashier_a",
    ...(input.tender === "card"
      ? { provider: "paystack", providerReference: "pos_rt01ref", providerTransactionId: "txn_rt01" }
      : {}),
  });
  await store.saveSale({ ...record, status: "completed", assignedPaymentId: paymentId, commercialConfirmed: true });
  return paymentId;
}

export async function createRt01Runtime(input?: {
  readonly tender?: "cash" | "card";
  readonly quantity?: Quantity;
  readonly lineTotal?: Money;
}) {
  const checkoutStore = createInMemoryCheckoutStore();
  const returnStore = createInMemoryReturnStore();
  await seedRegister(checkoutStore);
  const shiftId = await openRegister(checkoutStore);
  const paymentId = await seedCompletedSale(checkoutStore, {
    transactionId: TX_A,
    saleId: "woo-rt01",
    shiftId,
    tender: input?.tender ?? "cash",
    quantity: input?.quantity,
    lineTotal: input?.lineTotal,
  });
  const sessions = await staffCookies();
  const manager = await staffCookies({ actorId: "manager_a", displayName: "Manager A" });
  const refundProvider = createFakeElectronicRefundProvider();
  const bridge = createFakeBridgeReturnEffects(CORRELATION);
  return { checkoutStore, returnStore, shiftId, sessions, manager, refundProvider, bridge, paymentId };
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

export async function preview(
  runtime: Awaited<ReturnType<typeof createRt01Runtime>>,
  input?: {
    readonly quantity?: Quantity;
    readonly condition?: ReturnCondition;
    readonly requireApproval?: boolean;
    readonly cookieHeader?: string;
    readonly sessionStore?: ReturnType<typeof staffCookies> extends Promise<infer T> ? T["store"] : never;
    readonly saleId?: string;
    readonly client?: { readonly actorId?: string };
    readonly extra?: Record<string, unknown>;
  },
) {
  return handlePreviewReturn({
    ...commandBase(input?.cookieHeader ?? runtime.sessions.cookieHeader),
    sessionStore: input?.sessionStore ?? runtime.sessions.store,
    checkoutStore: runtime.checkoutStore,
    returnStore: runtime.returnStore,
    policies: createMemoryOperationalPolicyStore(
      input?.requireApproval
        ? [{
            id: "77777777-7777-4777-8777-777777777701",
            organizationId: "org_a",
            locationId: "loc_a1",
            registerId: "reg_a1",
            returnApprovalRequired: true,
            updatedByActorId: "owner_a",
            updatedAt: NOW.toISOString(),
          }]
        : [],
    ),
    client: input?.client,
    body: {
      saleId: input?.saleId ?? "woo-rt01",
      lines: [
        {
          orderLineId: LINE_1,
          quantity: input?.quantity ?? "1",
          reason: "customer changed mind",
          condition: input?.condition ?? "resellable",
        },
      ],
      ...input?.extra,
    },
  });
}

export async function execute(
  runtime: Awaited<ReturnType<typeof createRt01Runtime>>,
  body: unknown,
  key: string,
  cookieHeader = runtime.sessions.cookieHeader,
  sessionStore = runtime.sessions.store,
) {
  return handleExecuteReturn({
    ...commandBase(cookieHeader),
    sessionStore,
    checkoutStore: runtime.checkoutStore,
    returnStore: runtime.returnStore,
    provider: runtime.refundProvider,
    bridge: runtime.bridge,
    idempotencyKeyHeader: key,
    body,
  });
}

export async function resolveAggregate(
  runtime: Awaited<ReturnType<typeof createRt01Runtime>>,
  returnId: string,
) {
  return handleResolveReturn({
    ...commandBase(runtime.sessions.cookieHeader),
    sessionStore: runtime.sessions.store,
    checkoutStore: runtime.checkoutStore,
    returnStore: runtime.returnStore,
    provider: runtime.refundProvider,
    bridge: runtime.bridge,
    returnId,
  });
}

export async function resolveRefund(
  runtime: Awaited<ReturnType<typeof createRt01Runtime>>,
  refundId: string,
  cookieHeader = runtime.manager.cookieHeader,
  sessionStore = runtime.manager.store,
) {
  return handleResolveRefund({
    ...commandBase(cookieHeader),
    sessionStore,
    assignments: cashierAssignments(),
    checkoutStore: runtime.checkoutStore,
    returnStore: runtime.returnStore,
    provider: runtime.refundProvider,
    refundId,
  });
}

export async function approve(runtime: Awaited<ReturnType<typeof createRt01Runtime>>, returnId: string, ttlMs?: number) {
  return bindReturnApproval({
    returnStore: runtime.returnStore,
    actor: {
      actorId: "manager_a",
      displayName: "Manager A",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
    },
    returnId,
    correlationId: CORRELATION,
    now: NOW,
    ttlMs,
  });
}

export const EXEC_KEY = "66666666-6666-4666-8666-666666666601";
export const EXEC_KEY_2 = "66666666-6666-4666-8666-666666666602";
