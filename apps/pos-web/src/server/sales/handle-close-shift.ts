import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Shift } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { mayCloseShift } from "../auth/policy";
import { apiFailure } from "../http/api-failure";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { authorizeCheckoutRead } from "./authorize-checkout";
import { closeShift } from "./close-shift";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";
import { isCloseShiftRequest } from "./schema";
import type { OperationalCloseStore } from "../register/operational-close-store";
import type { OperationalPolicyStore } from "../admin/operational-policy-store";

export async function handleCloseShift(input: {
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
  readonly closeStore?: OperationalCloseStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly policies: OperationalPolicyStore;
}): Promise<{ readonly status: number; readonly body: ApiResult<Shift>; readonly headers: CommandHttpHeaders }> {
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
  if (!isCloseShiftRequest(input.body)) {
    const body = authFailure("VALIDATION_ERROR", "CloseShiftRequest is invalid", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!guard.idempotencyKey) {
    const body = authFailure("VALIDATION_ERROR", "Idempotency-Key must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const shift = await input.checkoutStore.getShift(input.body.shiftId);
  if (!shift) {
    const body = apiFailure("NOT_FOUND", "shift was not found", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  // The command guard already proved mutation CSRF/origin/session. This check
  // proves tenant/location/register assignment without applying the old
  // hard-coded manager-only shift.close matrix.
  const authorized = await authorizeCheckoutRead({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: shift.organizationId,
    locationId: shift.locationId,
    registerId: shift.registerId,
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }
  const role = authorized.data.assignmentRole;
  if (!role) {
    const body = authFailure("FORBIDDEN", "staff assignment role is required to close a shift", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const expected = shift.expectedCash ?? shift.openingFloat;
  if (input.body.countedCash.currency !== expected.currency) {
    const body = authFailure(
      "VALIDATION_ERROR",
      "counted cash currency must match shift",
      guard.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const varianceMinor = input.body.countedCash.minor - expected.minor;

  const policy = await input.policies.readEffective({
    organizationId: shift.organizationId,
    locationId: shift.locationId,
    registerId: shift.registerId,
  });
  if (policy === "unavailable") {
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "operational close policy is unavailable",
      guard.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const decision = mayCloseShift({
    role,
    actorId: authorized.data.session.actorId,
    shiftCashierId: shift.cashierId,
    varianceMinor,
    policy,
  });
  if (!decision.allowed) {
    const body = authFailure("FORBIDDEN", closeDeniedMessage(decision.reason), guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const result = await closeShift({
    store: input.checkoutStore,
    closeStore: input.closeStore,
    actor: authorized.data.session,
    request: input.body,
    context: { idempotencyKey: guard.idempotencyKey, correlationId: guard.correlationId },
    now: input.now,
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}

function closeDeniedMessage(
  reason:
    | "role_not_allowed"
    | "cashier_own_shift_only"
    | "manager_cannot_close_others"
    | "manager_required_for_variance",
): string {
  switch (reason) {
    case "cashier_own_shift_only":
      return "cashier may close only their own shift";
    case "manager_cannot_close_others":
      return "manager is not permitted to close another staff member's shift";
    case "manager_required_for_variance":
      return "drawer variance requires manager review";
    case "role_not_allowed":
      return "staff role is not permitted to close shifts by current policy";
  }
}
