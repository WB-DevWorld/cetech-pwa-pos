import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import type { CheckoutStore } from "../../core/checkout/types";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { assertMutationProtection, type MutationProtectionInput } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import { isUuid } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { apiFailure } from "../http/api-failure";
import type { CashCorrectionAdminStore, CashCorrectionResult, ManagementCashMovement } from "./cash-correction-admin-store";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";

const REASON_LIMIT = 240;

export async function handleListManagementCashMovements(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly checkout: CheckoutStore;
  readonly corrections: CashCorrectionAdminStore;
  readonly shiftId: string;
}): Promise<ApiResult<readonly ManagementCashMovement[]>> {
  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;
  if (!authority.data.sections.includes("shifts_cash")) {
    return authFailure("FORBIDDEN", "shift oversight is outside management authority", input.correlationId);
  }
  const shift = await loadScopedShift(
    input.checkout,
    input.shiftId,
    authority.data.organizationId,
    authority.data,
    input.correlationId,
  );
  if (!shift.ok) return shift;
  const rows = await input.corrections.listShift({
    organizationId: authority.data.organizationId,
    shiftId: shift.data.id,
  });
  if (rows === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "cash movements are unavailable", input.correlationId);
  }
  return { ok: true, data: rows, correlationId: input.correlationId };
}

export async function handleManagementCashCorrection(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly checkout: CheckoutStore;
  readonly corrections: CashCorrectionAdminStore;
  readonly shiftId: string;
  readonly movementId: string;
  readonly reason: string;
  readonly protection: MutationProtectionInput;
}): Promise<ApiResult<CashCorrectionResult>> {
  const protection = assertMutationProtection(input.protection);
  if (!protection.ok) {
    return authFailure(
      "FORBIDDEN",
      protection.reason === "csrf"
        ? "mutation requires matching CSRF cookie and header"
        : "mutation origin is not allowed",
      input.correlationId,
    );
  }
  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;
  if (!authority.data.sections.includes("shifts_cash")) {
    return authFailure("FORBIDDEN", "shift oversight is outside management authority", input.correlationId);
  }
  const reason = input.reason.trim();
  if (reason.length < 1 || reason.length > REASON_LIMIT) {
    return authFailure("VALIDATION_ERROR", "a cash correction reason is required", input.correlationId);
  }
  if (!isUuid(input.movementId)) {
    return authFailure("VALIDATION_ERROR", "cash movement id is invalid", input.correlationId);
  }
  const shift = await loadScopedShift(
    input.checkout,
    input.shiftId,
    authority.data.organizationId,
    authority.data,
    input.correlationId,
  );
  if (!shift.ok) return shift;
  if (!authority.data.managerLocationIds.includes(shift.data.locationId)) {
    return authFailure(
      "FORBIDDEN",
      "operational manager authority is required to reverse a cash movement",
      input.correlationId,
    );
  }
  if (shift.data.status !== "open") {
    return authFailure("VALIDATION_ERROR", "cash correction requires an open shift", input.correlationId);
  }
  const rows = await input.corrections.listShift({
    organizationId: authority.data.organizationId,
    shiftId: shift.data.id,
  });
  if (rows === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "cash movements are unavailable", input.correlationId);
  }
  const original = rows.find((row) => row.id === input.movementId);
  if (!original) {
    return apiFailure("NOT_FOUND", "cash movement was not found on this shift", input.correlationId);
  }
  if (original.kind === "correction") {
    return authFailure("VALIDATION_ERROR", "a correction cannot be corrected", input.correlationId);
  }
  const saved = await input.corrections.reverse({
    organizationId: authority.data.organizationId,
    movementId: original.id,
    reason,
    actorId: authority.data.actorId,
    correlationId: input.correlationId,
    approvalId: crypto.randomUUID(),
  });
  if (saved === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "cash correction was not committed", input.correlationId);
  }
  if (saved.signedAmountMinor !== -original.signedAmountMinor || saved.currency !== original.currency) {
    return authFailure("INTEGRATION_UNAVAILABLE", "cash correction did not reverse the original movement", input.correlationId);
  }
  return { ok: true, data: saved, correlationId: input.correlationId };
}

async function loadScopedShift(
  checkout: CheckoutStore,
  shiftId: string,
  organizationId: string,
  authority: { readonly controlRole: string | null; readonly managerLocationIds: readonly string[] },
  correlationId: Uuid,
): Promise<ApiResult<{ readonly id: string; readonly locationId: string; readonly status: string }>> {
  if (!isUuid(shiftId)) {
    return authFailure("VALIDATION_ERROR", "shift id is invalid", correlationId);
  }
  const shift = await checkout.getShift(shiftId);
  if (!shift || shift.organizationId !== organizationId) {
    return apiFailure("NOT_FOUND", "shift was not found", correlationId);
  }
  const organizationWide = authority.controlRole === "owner" || authority.controlRole === "admin";
  if (!organizationWide && !authority.managerLocationIds.includes(shift.locationId)) {
    return authFailure("FORBIDDEN", "shift is outside management authority", correlationId);
  }
  return {
    ok: true,
    data: { id: shift.id, locationId: shift.locationId, status: shift.status },
    correlationId,
  };
}
