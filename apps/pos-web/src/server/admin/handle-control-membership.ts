import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { assertMutationProtection, type MutationProtectionInput } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import { isOrganizationControlRole, type OrganizationControlRole } from "../auth/policy";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { StaffSessionStore } from "../auth/session-store";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import type { StaffAccessDirectory } from "./staff-access-directory";
import type {
  ControlMembershipAdminStore,
  ControlMembershipMutationResult,
} from "./control-membership-admin-store";

export async function handleSetControlMembership(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly staff: StaffAccessDirectory;
  readonly mutation: ControlMembershipAdminStore;
  readonly targetActorId: string;
  readonly controlRole: OrganizationControlRole;
  readonly status: "active" | "disabled";
  readonly protection: MutationProtectionInput;
}): Promise<ApiResult<ControlMembershipMutationResult>> {
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
      "organization owner/admin authority is required to change control membership",
      input.correlationId,
    );
  }
  if (!input.targetActorId || !isOrganizationControlRole(input.controlRole)) {
    return authFailure("VALIDATION_ERROR", "control membership input is invalid", input.correlationId);
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

  const targetIsOwner = target.controlRole === "owner";
  const grantingOwner = input.controlRole === "owner" && input.status === "active";
  if (
    authority.data.controlRole !== "owner" &&
    (targetIsOwner || grantingOwner)
  ) {
    return authFailure(
      "FORBIDDEN",
      "only an organization owner may grant or change owner authority",
      input.correlationId,
    );
  }

  const saved = await input.mutation.setMembership({
    organizationId: authority.data.organizationId,
    targetActorId: input.targetActorId,
    controlRole: input.controlRole,
    status: input.status,
    actorId: authority.data.actorId,
    correlationId: input.correlationId,
  });
  if (saved === "unavailable") {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "control membership update was not committed",
      input.correlationId,
    );
  }

  return {
    ok: true,
    data: saved,
    correlationId: input.correlationId,
  };
}
