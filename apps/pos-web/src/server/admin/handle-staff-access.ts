import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { assertMutationProtection, type MutationProtectionInput } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import { isStaffAssignmentRole, type StaffAssignmentRole } from "../auth/roles";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { StaffSessionStore } from "../auth/session-store";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import type {
  StaffAccessDirectory,
  StaffAccessRecord,
} from "./staff-access-directory";
import type {
  StaffAssignmentAdminStore,
  StaffAssignmentMutationResult,
} from "./staff-assignment-admin-store";

type Common = {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly staff: StaffAccessDirectory;
};

export async function handleListStaffAccess(
  input: Common,
): Promise<ApiResult<readonly StaffAccessRecord[]>> {
  const authority = await loadManagementAuthority(input);
  if (!authority.ok) return authority;
  if (!authority.data.sections.includes("staff_access")) {
    return authFailure("FORBIDDEN", "staff access is outside management authority", input.correlationId);
  }

  const rows = await input.staff.listOrganization({
    organizationId: authority.data.organizationId,
  });
  if (rows === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "staff access directory is unavailable", input.correlationId);
  }

  const canSeeOrganization =
    authority.data.controlRole === "owner" || authority.data.controlRole === "admin";
  const visible = canSeeOrganization
    ? rows
    : rows.flatMap((row) => {
        const locations = row.locations.filter((location) =>
          authority.data.managerLocationIds.includes(location.locationId),
        );
        if (locations.length === 0) return [];
        return [{ ...row, controlRole: null, locations }];
      });

  return {
    ok: true,
    data: visible,
    correlationId: input.correlationId,
  };
}

export async function handleSetStaffAssignment(
  input: Common & {
    readonly targetActorId: string;
    readonly locationId: string;
    readonly role: StaffAssignmentRole;
    readonly registerIds: readonly string[];
    readonly mutation: StaffAssignmentAdminStore;
    readonly protection: MutationProtectionInput;
  },
): Promise<ApiResult<StaffAssignmentMutationResult>> {
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
      "organization admin authority is required to change staff assignments",
      input.correlationId,
    );
  }
  if (!isStaffAssignmentRole(input.role)) {
    return authFailure("VALIDATION_ERROR", "staff assignment role is invalid", input.correlationId);
  }
  if (
    !input.targetActorId ||
    !input.locationId ||
    input.registerIds.some((id) => typeof id !== "string" || id.length === 0)
  ) {
    return authFailure("VALIDATION_ERROR", "staff assignment input is invalid", input.correlationId);
  }

  const rows = await input.staff.listOrganization({
    organizationId: authority.data.organizationId,
  });
  if (rows === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "staff access directory is unavailable", input.correlationId);
  }
  if (!rows.some((row) => row.actorId === input.targetActorId)) {
    return authFailure("NOT_FOUND", "staff identity was not found in this organization", input.correlationId);
  }

  const saved = await input.mutation.setAssignment({
    organizationId: authority.data.organizationId,
    targetActorId: input.targetActorId,
    locationId: input.locationId,
    role: input.role,
    registerIds: input.registerIds,
    actorId: authority.data.actorId,
    correlationId: input.correlationId,
  });
  if (saved === "unavailable") {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "staff assignment update was not committed",
      input.correlationId,
    );
  }

  return {
    ok: true,
    data: saved,
    correlationId: input.correlationId,
  };
}
