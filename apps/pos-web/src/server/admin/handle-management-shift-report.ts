import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { ShiftReport, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { CheckoutStore } from "../../core/checkout/types";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { isUuid } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { apiFailure } from "../http/api-failure";
import { validateCanonicalDef } from "../quotes/canonical-schema";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";

/**
 * Management read of an existing X or Z report.
 * Z is the stored durable row. X is the live expected-cash view and is not inserted.
 */
export async function handleManagementShiftReport(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly checkout: CheckoutStore;
  readonly shiftId: string;
  readonly kind: string;
}): Promise<ApiResult<ShiftReport>> {
  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;
  if (!authority.data.sections.includes("shifts_cash")) {
    return authFailure("FORBIDDEN", "shift oversight is outside management authority", input.correlationId);
  }
  if (!isUuid(input.shiftId)) {
    return authFailure("VALIDATION_ERROR", "shift id is invalid", input.correlationId);
  }
  if (input.kind !== "X" && input.kind !== "Z") {
    return authFailure("VALIDATION_ERROR", "report kind must be X or Z", input.correlationId);
  }
  const shift = await input.checkout.getShift(input.shiftId);
  if (!shift || shift.organizationId !== authority.data.organizationId) {
    return apiFailure("NOT_FOUND", "shift was not found", input.correlationId);
  }
  const organizationWide =
    authority.data.controlRole === "owner" || authority.data.controlRole === "admin";
  if (!organizationWide && !authority.data.managerLocationIds.includes(shift.locationId)) {
    return authFailure("FORBIDDEN", "shift is outside management authority", input.correlationId);
  }
  if (input.kind === "Z") {
    if (shift.status !== "closed" || !shift.zReportId) {
      return authFailure("VALIDATION_ERROR", "Z report is only available for a closed shift", input.correlationId);
    }
    const durable = await input.checkout.getShiftReport(shift.id, "Z");
    if (!durable || durable.kind !== "Z" || durable.id !== shift.zReportId) {
      return authFailure("INTEGRATION_UNAVAILABLE", "closed shift is missing its durable Z report", input.correlationId);
    }
    if (!validateCanonicalDef("ShiftReport", durable)) {
      return authFailure("INTEGRATION_UNAVAILABLE", "shift report is invalid", input.correlationId);
    }
    return { ok: true, data: durable, correlationId: input.correlationId };
  }
  if (shift.status !== "open" && shift.status !== "closing") {
    return authFailure("VALIDATION_ERROR", "X report is available while the shift is open", input.correlationId);
  }
  const expected = shift.expectedCash ?? (await input.checkout.expectedCash(shift.id)) ?? shift.openingFloat;
  const report: ShiftReport = {
    id: `report-x-${shift.id}`,
    shiftId: shift.id,
    kind: "X",
    expectedCash: expected,
    createdAt: shift.openedAt,
  };
  if (!validateCanonicalDef("ShiftReport", report)) {
    return authFailure("INTEGRATION_UNAVAILABLE", "shift report is invalid", input.correlationId);
  }
  return { ok: true, data: report, correlationId: input.correlationId };
}
