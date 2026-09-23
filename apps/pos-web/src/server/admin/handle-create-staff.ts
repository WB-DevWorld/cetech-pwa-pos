import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { assertMutationProtection, type MutationProtectionInput } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import { temporaryPasswordError } from "../auth/password-policy";
import { isOrganizationControlRole, type OrganizationControlRole } from "../auth/policy";
import { isStaffAssignmentRole, type StaffAssignmentRole } from "../auth/roles";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { StaffSessionStore } from "../auth/session-store";
import type { AdminAuditStore } from "./admin-audit-store";
import type { ControlMembershipAdminStore } from "./control-membership-admin-store";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import type { ManagementTopologyDirectory } from "./management-topology-directory";
import type { StaffAccessStatusAdminStore } from "./staff-access-status-admin-store";
import type { StaffAssignmentAdminStore } from "./staff-assignment-admin-store";
import type { StaffIdentityAdminStore } from "./staff-identity-admin-store";

export type StaffLocationProvision = {
  readonly locationId: string;
  readonly role: StaffAssignmentRole;
  readonly registerIds: readonly string[];
};

export type CreatedStaffAccount = {
  readonly actorId: string;
  readonly email: string;
  readonly displayName: string;
  readonly posAccessStatus: "active" | "disabled";
  readonly setupStatus: "complete" | "incomplete";
  readonly mustChangePassword: true;
};

export async function handleCreateStaffAccount(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly identities: StaffIdentityAdminStore;
  readonly accessStatus: StaffAccessStatusAdminStore;
  readonly memberships: ControlMembershipAdminStore;
  readonly staffAssignments: StaffAssignmentAdminStore;
  readonly topology: ManagementTopologyDirectory;
  readonly audit: AdminAuditStore;
  readonly email: string;
  readonly displayName: string;
  readonly temporaryPassword: string;
  readonly controlRole: OrganizationControlRole | null;
  readonly locations: readonly StaffLocationProvision[];
  readonly enableAccess: boolean;
  readonly protection: MutationProtectionInput;
}): Promise<ApiResult<CreatedStaffAccount>> {
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
      "organization owner or admin authority is required to add staff",
      input.correlationId,
    );
  }

  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const passwordError = temporaryPasswordError(input.temporaryPassword);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return authFailure("VALIDATION_ERROR", "Enter a valid staff email address.", input.correlationId);
  }
  if (displayName.length < 1 || displayName.length > 128) {
    return authFailure("VALIDATION_ERROR", "Enter the staff member's name.", input.correlationId);
  }
  if (passwordError) {
    return authFailure("VALIDATION_ERROR", passwordError, input.correlationId);
  }
  if (input.controlRole !== null && !isOrganizationControlRole(input.controlRole)) {
    return authFailure("VALIDATION_ERROR", "Choose a valid organization role.", input.correlationId);
  }
  if (input.controlRole === "owner" && authority.data.controlRole !== "owner") {
    return authFailure(
      "FORBIDDEN",
      "Only an Owner can give someone the Owner role.",
      input.correlationId,
    );
  }
  if (input.locations.some((row) => !isStaffAssignmentRole(row.role) || row.registerIds.length < 1)) {
    return authFailure(
      "VALIDATION_ERROR",
      "Each location assignment needs a Cashier or Manager role and at least one register.",
      input.correlationId,
    );
  }

  const topology = await input.topology.listOrganization({
    organizationId: authority.data.organizationId,
  });
  if (topology === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "Locations could not be checked.", input.correlationId);
  }
  for (const assignment of input.locations) {
    const location = topology.find((row) => row.id === assignment.locationId);
    if (!location) {
      return authFailure("FORBIDDEN", "That location is outside this organization.", input.correlationId);
    }
    const registerIds = new Set(location.registers.map((row) => row.id));
    if (assignment.registerIds.some((id) => !registerIds.has(id))) {
      return authFailure("FORBIDDEN", "A register is outside the selected location.", input.correlationId);
    }
  }

  const created = await input.identities.createWithTemporaryPassword({
    organizationId: authority.data.organizationId,
    email,
    displayName,
    temporaryPassword: input.temporaryPassword,
  });
  if (created === "conflict") {
    return apiFailure("VALIDATION_ERROR", "This email is already in use.", input.correlationId);
  }
  if (created === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "The staff account could not be created.", input.correlationId);
  }

  const disabled = await input.accessStatus.setStatus({
    organizationId: authority.data.organizationId,
    targetActorId: created.actorId,
    status: "disabled",
    reason: "Staff account awaiting completed setup",
    actorId: authority.data.actorId,
    correlationId: input.correlationId,
  });
  if (disabled === "unavailable") {
    await input.identities.suspendAuthUser(created.authUserId);
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "The new account could not be secured, so POS access was not opened.",
      input.correlationId,
    );
  }

  let setupStatus: "complete" | "incomplete" = "complete";
  if (input.controlRole) {
    const membership = await input.memberships.setMembership({
      organizationId: authority.data.organizationId,
      targetActorId: created.actorId,
      controlRole: input.controlRole,
      status: "active",
      actorId: authority.data.actorId,
      correlationId: input.correlationId,
    });
    if (membership === "unavailable") setupStatus = "incomplete";
  }

  if (setupStatus === "complete") {
    for (const assignment of input.locations) {
      const saved = await input.staffAssignments.setAssignment({
        organizationId: authority.data.organizationId,
        targetActorId: created.actorId,
        locationId: assignment.locationId,
        role: assignment.role,
        registerIds: assignment.registerIds,
        actorId: authority.data.actorId,
        correlationId: input.correlationId,
      });
      if (saved === "unavailable") {
        setupStatus = "incomplete";
        break;
      }
    }
  }

  let posAccessStatus: "active" | "disabled" = "disabled";

  // Record identity provisioning before POS access can be enabled. Access-status,
  // membership, and assignment stores already write their own durable audit
  // records. If this identity audit cannot be committed, provisioning remains
  // incomplete and the account stays POS-disabled.
  const audited = await input.audit.append({
    organizationId: authority.data.organizationId,
    actorId: authority.data.actorId,
    action: "staff.identity.created",
    targetType: "staff_identity",
    targetId: created.actorId,
    afterState: {
      email: created.email,
      displayName: created.displayName,
      posAccessStatus: "disabled",
      requestedPosAccessStatus: input.enableAccess ? "active" : "disabled",
      setupStatus,
      controlRole: input.controlRole,
      locationCount: input.locations.length,
      mustChangePassword: true,
    },
    correlationId: input.correlationId,
  });
  if (audited === "unavailable") {
    setupStatus = "incomplete";
  }

  if (setupStatus === "complete" && input.enableAccess) {
    const enabled = await input.accessStatus.setStatus({
      organizationId: authority.data.organizationId,
      targetActorId: created.actorId,
      status: "active",
      reason: "Staff setup completed",
      actorId: authority.data.actorId,
      correlationId: input.correlationId,
    });
    posAccessStatus = enabled === "unavailable" ? "disabled" : "active";
    if (enabled === "unavailable") setupStatus = "incomplete";
  }

  return {
    ok: true,
    data: {
      actorId: created.actorId,
      email: created.email,
      displayName: created.displayName,
      posAccessStatus,
      setupStatus,
      mustChangePassword: true,
    },
    correlationId: input.correlationId,
  };
}
