import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Register } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { authorizeCheckoutRead } from "./authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";
import { toPublicRegister } from "./shift-public";
import { validateCanonicalDef } from "../quotes/canonical-schema";

export async function handleGetRegister(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly registerId: string;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly assignments: StaffAssignmentDirectory;
}): Promise<{ readonly status: number; readonly body: ApiResult<Register>; readonly headers: CommandHttpHeaders }> {
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
  if (!guard.ok) {
    return { status: guard.status, body: guard.body, headers: guard.headers };
  }
  if (!input.registerId) {
    const body = authFailure("VALIDATION_ERROR", "registerId is required", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const register = await input.checkoutStore.getRegister(input.registerId);
  if (!register) {
    const body = apiFailure("NOT_FOUND", "register is not available", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const authorized = await authorizeCheckoutRead({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: register.organizationId,
    locationId: register.locationId,
    registerId: register.id,
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }
  const data = toPublicRegister(register);
  if (!validateCanonicalDef("Register", data)) {
    const body = apiFailure("INTEGRATION_UNAVAILABLE", "register record is invalid", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  return { status: 200, body: { ok: true, data, correlationId: guard.correlationId }, headers: guard.headers };
}
