import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type { PreparedSale } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import { apiFailure } from "../http/api-failure";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import type { PrepareIntentStore, QuoteSnapshotStore } from "../../core/checkout/supabase-store";
import { authorizeCheckoutMutation, mutationProtectionFrom } from "./authorize-checkout";
import { buildPreparedSaleSeed } from "./prepare-sale-record";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";
import { isPrepareSaleRequest } from "./schema";

export type HandlePrepareSaleInput = {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly idempotencyKeyHeader?: string | null;
  readonly body: unknown;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly quoteSnapshots: QuoteSnapshotStore;
  readonly prepareIntents: PrepareIntentStore;
  readonly salesPort: Pick<SalesPort, "prepare">;
  readonly assignments: StaffAssignmentDirectory;
};

export type HandlePrepareSaleResponse = {
  readonly status: number;
  readonly body: ApiResult<PreparedSale>;
  readonly headers: CommandHttpHeaders;
};

export async function handlePrepareSale(input: HandlePrepareSaleInput): Promise<HandlePrepareSaleResponse> {
  const guard = await guardStaffCommand({
    correlationIdHeader: input.correlationIdHeader,
    origin: input.origin,
    referer: input.referer,
    cookieHeader: input.cookieHeader,
    csrfHeader: input.csrfHeader,
    now: input.now,
    sessionStore: input.sessionStore,
    allowedOrigins: input.allowedOrigins,
    requireMutationProtection: true,
    idempotencyKeyHeader: input.idempotencyKeyHeader,
    requireIdempotencyKey: true,
  });
  if (!guard.ok) return { status: guard.status, body: guard.body, headers: guard.headers };
  if (!isPrepareSaleRequest(input.body)) {
    const body = authFailure("VALIDATION_ERROR", "PrepareSaleRequest is invalid", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!guard.idempotencyKey) {
    const body = authFailure("VALIDATION_ERROR", "Idempotency-Key must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const snapshot = await input.quoteSnapshots.get(guard.session.organizationId, input.body.quoteId);
  if (!snapshot) {
    const body = apiFailure("QUOTE_EXPIRED", "authoritative quote snapshot is not available", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (snapshot.quote.fingerprint !== input.body.quoteFingerprint) {
    const body = apiFailure(
      "QUOTE_CHANGED",
      "quote fingerprint changed before prepare",
      guard.correlationId,
      { currentQuoteId: snapshot.quote.id },
    );
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (new Date(snapshot.quote.expiresAt).getTime() <= input.now.getTime()) {
    const body = apiFailure("QUOTE_EXPIRED", "authoritative quote expired before prepare", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!snapshot.quote.purchasable) {
    const body = apiFailure("QUOTE_CHANGED", "authoritative quote is not purchasable", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const [register, device, shift] = await Promise.all([
    input.checkoutStore.getRegister(input.body.registerId),
    input.checkoutStore.getDevice(input.body.deviceId),
    input.checkoutStore.getShift(input.body.shiftId),
  ]);
  if (!register || register.status !== "active") {
    const body = apiFailure("SHIFT_REQUIRED", "active register is required", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!device || device.status !== "active") {
    const body = apiFailure("SHIFT_REQUIRED", "active POS device is required", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!shift || shift.status !== "open") {
    const body = apiFailure("SHIFT_REQUIRED", "open shift is required", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (
    register.organizationId !== guard.session.organizationId ||
    register.locationId !== snapshot.quote.locationId ||
    device.organizationId !== register.organizationId ||
    device.locationId !== register.locationId ||
    shift.organizationId !== register.organizationId ||
    shift.locationId !== register.locationId ||
    shift.registerId !== register.id ||
    shift.deviceId !== device.id
  ) {
    const body = apiFailure("SHIFT_CONFLICT", "prepare scope does not match the active register shift", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const authorized = await authorizeCheckoutMutation({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: register.organizationId,
    locationId: register.locationId,
    registerId: register.id,
    permission: "sale.prepare",
    protection: mutationProtectionFrom(input),
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }

  const intent = {
    organizationId: register.organizationId,
    locationId: register.locationId,
    registerId: register.id,
    shiftId: shift.id,
    deviceId: device.id,
    cashierId: guard.session.actorId,
    cashierName: guard.session.displayName,
    request: input.body,
    context: { idempotencyKey: guard.idempotencyKey, correlationId: guard.correlationId },
    createdAt: input.now.toISOString(),
  } as const;
  await input.prepareIntents.save(intent);

  const prepared = await input.salesPort.prepare(input.body, intent.context);
  if (!prepared.ok) {
    return { status: httpStatusFor(prepared.error.code), body: prepared, headers: guard.headers };
  }
  try {
    await input.checkoutStore.seedPreparedSale(
      buildPreparedSaleSeed({ snapshot, intent, prepared: prepared.data, register, device, shift }),
    );
  } catch {
    const body = apiFailure(
      "INTEGRATION_UNAVAILABLE",
      "Woo prepare succeeded but POS workflow persistence needs repair; resolve this transaction before taking money",
      guard.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  return { status: 200, body: prepared, headers: guard.headers };
}
