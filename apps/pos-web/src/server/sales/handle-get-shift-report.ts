import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { ShiftReport, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import { isUuid } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { authorizeCheckoutRead } from "./authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";
import { validateCanonicalDef } from "../quotes/canonical-schema";

export async function handleGetShiftReport(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly shiftId: string;
  readonly kind: string | null;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly assignments: StaffAssignmentDirectory;
}): Promise<{ readonly status: number; readonly body: ApiResult<ShiftReport>; readonly headers: CommandHttpHeaders }> {
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
  if (!isUuid(input.shiftId)) {
    const body = authFailure("VALIDATION_ERROR", "shiftId must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (input.kind !== "X" && input.kind !== "Z") {
    const body = authFailure("VALIDATION_ERROR", "report kind must be X or Z", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const shift = await input.checkoutStore.getShift(input.shiftId as Uuid);
  if (!shift) {
    const body = apiFailure("NOT_FOUND", "shift was not found", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
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
  const expected = shift.expectedCash ?? (await input.checkoutStore.expectedCash(shift.id)) ?? shift.openingFloat;
  if (input.kind === "Z" && shift.status !== "closed") {
    const body = apiFailure("VALIDATION_ERROR", "Z report is only available after the shift is closed", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const report: ShiftReport = {
    id: shift.zReportId ?? `report-${input.kind.toLowerCase()}-${shift.id}`,
    shiftId: shift.id,
    kind: input.kind,
    expectedCash: expected,
    createdAt: shift.closedAt ?? shift.openedAt,
    ...(input.kind === "Z"
      ? {
          countedCash: shift.countedCash,
          variance: shift.variance,
        }
      : {}),
  };
  if (!validateCanonicalDef("ShiftReport", report)) {
    const body = apiFailure("INTEGRATION_UNAVAILABLE", "shift report is invalid", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  return { status: 200, body: { ok: true, data: report, correlationId: guard.correlationId }, headers: guard.headers };
}
