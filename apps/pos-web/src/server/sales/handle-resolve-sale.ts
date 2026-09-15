import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type { SaleResolution, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { StaffSessionStore } from "../auth/session-store";
import { apiFailure } from "../http/api-failure";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore, PosSaleRecord } from "../../core/checkout/types";
import type { PrepareIntentStore, QuoteSnapshotStore } from "../../core/checkout/supabase-store";
import { authorizeCheckoutRead } from "./authorize-checkout";
import { buildPreparedSaleSeed, reconstructPreparedSale } from "./prepare-sale-record";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";

export type HandleResolveSaleInput = {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly transactionId: Uuid;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly quoteSnapshots: QuoteSnapshotStore;
  readonly prepareIntents: PrepareIntentStore;
  readonly salesPort: Pick<SalesPort, "resolve">;
  readonly assignments: StaffAssignmentDirectory;
};

export type HandleResolveSaleResponse = {
  readonly status: number;
  readonly body: ApiResult<SaleResolution>;
  readonly headers: CommandHttpHeaders;
};

export async function handleResolveSale(input: HandleResolveSaleInput): Promise<HandleResolveSaleResponse> {
  const guard = await guardStaffCommand({
    correlationIdHeader: input.correlationIdHeader,
    origin: input.origin,
    referer: input.referer,
    cookieHeader: input.cookieHeader,
    csrfHeader: input.csrfHeader,
    now: input.now,
    sessionStore: input.sessionStore,
    allowedOrigins: input.allowedOrigins,
    requireMutationProtection: false,
    requireIdempotencyKey: false,
  });
  if (!guard.ok) return { status: guard.status, body: guard.body, headers: guard.headers };

  const existing = await input.checkoutStore.getSale(input.transactionId);
  if (existing) {
    const allowed = await authorizeCheckoutRead({
      session: guard.session,
      assignments: input.assignments,
      correlationId: guard.correlationId,
      organizationId: existing.organizationId,
      locationId: existing.locationId,
      registerId: existing.registerId,
    });
    if (!allowed.ok) {
      return { status: httpStatusFor(allowed.error.code), body: allowed, headers: guard.headers };
    }
    return {
      status: 200,
      body: { ok: true, data: resolutionFromSale(existing), correlationId: guard.correlationId },
      headers: guard.headers,
    };
  }

  const intent = await input.prepareIntents.get(input.transactionId);
  if (!intent || intent.organizationId !== guard.session.organizationId) {
    const body = apiFailure("NOT_FOUND", "sale transaction was not found", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const allowed = await authorizeCheckoutRead({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: intent.organizationId,
    locationId: intent.locationId,
    registerId: intent.registerId,
  });
  if (!allowed.ok) {
    return { status: httpStatusFor(allowed.error.code), body: allowed, headers: guard.headers };
  }

  const commercial = await input.salesPort.resolve(input.transactionId);
  if (!commercial.ok) {
    return { status: httpStatusFor(commercial.error.code), body: commercial, headers: guard.headers };
  }
  if (!commercial.data.saleId || !commercial.data.orderReference) {
    return { status: 200, body: { ...commercial, correlationId: guard.correlationId }, headers: guard.headers };
  }

  const snapshot = await input.quoteSnapshots.get(intent.organizationId, intent.request.quoteId);
  const [register, device, shift] = await Promise.all([
    input.checkoutStore.getRegister(intent.registerId),
    input.checkoutStore.getDevice(intent.deviceId),
    input.checkoutStore.getShift(intent.shiftId),
  ]);
  if (!snapshot || !register || !device || !shift) {
    const body = apiFailure(
      "INTEGRATION_UNAVAILABLE",
      "commercial sale exists but durable POS prepare context cannot be reconstructed",
      guard.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const prepared = reconstructPreparedSale({ snapshot, intent, resolution: commercial.data });
  if (!prepared) {
    return { status: 200, body: { ...commercial, correlationId: guard.correlationId }, headers: guard.headers };
  }

  const seeded = await input.checkoutStore.seedPreparedSale(
    buildPreparedSaleSeed({ snapshot, intent, prepared, register, device, shift }),
  );
  if (commercial.data.status === "completed") {
    const repaired: PosSaleRecord = {
      ...seeded,
      status: "finalizing",
      commercialConfirmed: true,
      ...(commercial.data.paymentId ? { assignedPaymentId: commercial.data.paymentId } : {}),
    };
    await input.checkoutStore.saveSale(repaired);
    return {
      status: 200,
      body: {
        ok: true,
        correlationId: guard.correlationId,
        data: {
          ...commercial.data,
          status: "finalizing",
          message: "Woo completion is proven; POS workflow persistence still needs finalize repair.",
        },
      },
      headers: guard.headers,
    };
  }
  if (commercial.data.status === "requires_attention") {
    await input.checkoutStore.saveSale({ ...seeded, status: "requires_attention" });
  }
  return { status: 200, body: { ...commercial, correlationId: guard.correlationId }, headers: guard.headers };
}

function resolutionFromSale(sale: PosSaleRecord): SaleResolution {
  return {
    transactionId: sale.prepared.transactionId,
    status: sale.status,
    saleId: sale.prepared.saleId,
    orderReference: sale.prepared.orderReference,
    ...(sale.receipt ? { receiptId: sale.receipt.id } : {}),
    ...(sale.assignedPaymentId ? { paymentId: sale.assignedPaymentId } : {}),
    ...(sale.status === "requires_attention"
      ? { message: "POS workflow requires repair before another sale is started." }
      : {}),
  };
}
