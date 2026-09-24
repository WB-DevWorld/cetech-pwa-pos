import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { assertMutationProtection, type MutationProtectionInput } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { StaffSessionStore } from "../auth/session-store";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import type { StaffAccessDirectory } from "./staff-access-directory";
import type {
  StaffAccessStatusAdminStore,
  StaffAccessStatusMutationResult,
} from "./staff-access-status-admin-store";

export async function handleSetStaffAccessStatus(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly staff: StaffAccessDirectory;
  readonly mutation: StaffAccessStatusAdminStore;
  readonly targetActorId: string;
  readonly status: "active" | "disabled";
  readonly reason?: string;
  readonly protection: MutationProtectionInput;
}): Promise<ApiResult<StaffAccessStatusMutationResult>> {
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
  if (authority.data.controlRole !== "owner" && authority.data.controlRole !== "admin") {
    return authFailure(
      "FORBIDDEN",
      "organization owner/admin authority is required to change staff access",
      input.correlationId,
    );
  }
  if (!input.targetActorId) {
    return authFailure("VALIDATION_ERROR", "target staff actor is required", input.correlationId);
  }
  if (input.status === "disabled" && input.targetActorId === authority.data.actorId) {
    return authFailure(
      "FORBIDDEN",
      "you cannot disable your own active management access",
      input.correlationId,
    );
  }

  const rows = await input.staff.listOrganization({
    organizationId: authority.data.organizationId,
  });
  if (rows === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "staff access directory is unavailable", input.correlationId);
  }
  const target = rows.find((row) => row.actorId === input.targetActorId);
  if (!target) {
    return apiFailure("NOT_FOUND", "staff identity was not found in this organization", input.correlationId);
  }
  if (input.status === "disabled" && target.controlRole === "owner") {
    return authFailure(
      "FORBIDDEN",
      "transfer or remove owner authority before disabling this staff account",
      input.correlationId,
    );
  }
  if (authority.data.controlRole === "admin" && target.controlRole === "owner") {
    return authFailure(
      "FORBIDDEN",
      "an admin cannot change an owner account",
      input.correlationId,
    );
  }

  const saved = await input.mutation.setStatus({
    organizationId: authority.data.organizationId,
    targetActorId: input.targetActorId,
    status: input.status,
    reason: input.reason,
    actorId: authority.data.actorId,
    correlationId: input.correlationId,
  });
  if (saved === "unavailable") {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "staff access-status update was not committed",
      input.correlationId,
    );
  }

  return {
    ok: true,
    data: saved,
    correlationId: input.correlationId,
  };
}
