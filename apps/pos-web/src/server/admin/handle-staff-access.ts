import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { assertMutationProtection, type MutationProtectionInput } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
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
import type { ManagementTopologyDirectory } from "./management-topology-directory";

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
    readonly topology?: ManagementTopologyDirectory;
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
  const organizationManager =
    authority.data.controlRole === "owner" || authority.data.controlRole === "admin";
  const scopedManager = authority.data.managerLocationIds.includes(input.locationId);
  if (!organizationManager && !scopedManager) {
    return authFailure(
      "FORBIDDEN",
      "staff assignment is outside management authority",
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
  const target = rows.find((row) => row.actorId === input.targetActorId);
  if (!target) {
    return apiFailure("NOT_FOUND", "staff identity was not found in this organization", input.correlationId);
  }
  if (!input.topology) {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "register scope could not be verified",
      input.correlationId,
    );
  }
  const topology = await input.topology.listOrganization({
    organizationId: authority.data.organizationId,
  });
  if (topology === "unavailable") {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "register scope could not be verified",
      input.correlationId,
    );
  }
  const targetLocation = topology.find((row) => row.id === input.locationId);
  if (!targetLocation) {
    return authFailure("FORBIDDEN", "That location is outside this organization.", input.correlationId);
  }
  if (targetLocation.status === "inactive") {
    return authFailure("VALIDATION_ERROR", "Choose an active location for POS access.", input.correlationId);
  }
  const registerById = new Map(targetLocation.registers.map((row) => [row.id, row]));
  if (input.registerIds.some((id) => !registerById.has(id))) {
    return authFailure("FORBIDDEN", "A register is outside the selected location.", input.correlationId);
  }
  if (input.registerIds.some((id) => registerById.get(id)?.status !== "active")) {
    return authFailure("VALIDATION_ERROR", "Choose only active registers for POS access.", input.correlationId);
  }

  const existing = target.locations.find((location) => location.locationId === input.locationId);
  let role = input.role;
  let registersOnly = false;
  if (!organizationManager) {
    if (authority.data.actorId === input.targetActorId) {
      return authFailure(
        "FORBIDDEN",
        "a manager cannot change their own assignment",
        input.correlationId,
      );
    }
    if (!existing) {
      return authFailure(
        "FORBIDDEN",
        "manager assignment can only update staff already assigned at that location",
        input.correlationId,
      );
    }
    if (input.role !== existing.role) {
      return authFailure(
        "FORBIDDEN",
        "manager assignment cannot change operational role",
        input.correlationId,
      );
    }
    role = existing.role;
    registersOnly = true;
  }

  const saved = await input.mutation.setAssignment({
    organizationId: authority.data.organizationId,
    targetActorId: input.targetActorId,
    locationId: input.locationId,
    role,
    registerIds: input.registerIds,
    actorId: authority.data.actorId,
    correlationId: input.correlationId,
    registersOnly,
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
