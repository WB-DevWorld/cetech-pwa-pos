import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Shift } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { authorizeCheckoutMutation, mutationProtectionFrom } from "./authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";
import { openShift } from "./open-shift";
import { isOpenShiftRequest } from "./schema";

export type HandleOpenShiftInput = {
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
  readonly assignments: StaffAssignmentDirectory;
};

export type HandleOpenShiftResponse = {
  readonly status: number;
  readonly body: ApiResult<Shift>;
  readonly headers: CommandHttpHeaders;
};

export async function handleOpenShift(input: HandleOpenShiftInput): Promise<HandleOpenShiftResponse> {
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
  if (!guard.ok) {
    return { status: guard.status, body: guard.body, headers: guard.headers };
  }
  if (!isOpenShiftRequest(input.body)) {
    const body = authFailure("VALIDATION_ERROR", "OpenShiftRequest is invalid", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!guard.idempotencyKey) {
    const body = authFailure("VALIDATION_ERROR", "Idempotency-Key must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const register = await input.checkoutStore.getRegister(input.body.registerId);
  if (!register) {
    const body = apiFailure("NOT_FOUND", "register is not available", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const authorized = await authorizeCheckoutMutation({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: register.organizationId,
    locationId: register.locationId,
    registerId: register.id,
    permission: "shift.open",
    protection: mutationProtectionFrom(input),
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }
  const result = await openShift({
    store: input.checkoutStore,
    actor: authorized.data.session,
    request: input.body,
    context: { idempotencyKey: guard.idempotencyKey, correlationId: guard.correlationId },
    now: input.now,
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}
