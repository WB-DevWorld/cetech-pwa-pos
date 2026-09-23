import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { assertMutationProtection, type MutationProtectionInput } from "../auth/csrf";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import { temporaryPasswordError } from "../auth/password-policy";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { StaffSessionStore } from "../auth/session-store";
import type { AdminAuditStore } from "./admin-audit-store";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { loadManagementAuthority } from "./management-authority";
import type { StaffIdentityAdminStore } from "./staff-identity-admin-store";

export async function handleResetStaffPassword(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
  readonly identities: StaffIdentityAdminStore;
  readonly audit: AdminAuditStore;
  readonly targetActorId: string;
  readonly temporaryPassword: string;
  readonly protection: MutationProtectionInput;
}): Promise<ApiResult<{ readonly reset: true; readonly mustChangePassword: true }>> {
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
    return authFailure("FORBIDDEN", "Only an Owner or Admin can reset a staff password.", input.correlationId);
  }
  const passwordError = temporaryPasswordError(input.temporaryPassword);
  if (passwordError) {
    return authFailure("VALIDATION_ERROR", passwordError, input.correlationId);
  }
  const found = await input.identities.findByActor({
    organizationId: authority.data.organizationId,
    actorId: input.targetActorId,
  });
  if (found === "missing") {
    return apiFailure("NOT_FOUND", "That staff account could not be found.", input.correlationId);
  }
  if (found === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "The staff account could not be checked.", input.correlationId);
  }
  const reset = await input.identities.resetTemporaryPassword({
    authUserId: found.authUserId,
    temporaryPassword: input.temporaryPassword,
  });
  if (reset !== "ok") {
    return authFailure("INTEGRATION_UNAVAILABLE", "The temporary password could not be saved.", input.correlationId);
  }
  try {
    await input.sessions.revokeActorSessions({
      organizationId: authority.data.organizationId,
      actorId: input.targetActorId,
    });
  } catch {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "The temporary password was saved, but active POS sign-ins could not be closed.",
      input.correlationId,
    );
  }
  const audited = await input.audit.append({
    organizationId: authority.data.organizationId,
    actorId: authority.data.actorId,
    action: "staff.password.reset",
    targetType: "staff_identity",
    targetId: input.targetActorId,
    afterState: { mustChangePassword: true, sessionsRevoked: true },
    correlationId: input.correlationId,
  });
  if (audited !== "ok") {
    return authFailure("INTEGRATION_UNAVAILABLE", "The password reset could not be recorded.", input.correlationId);
  }
  return {
    ok: true,
    data: { reset: true, mustChangePassword: true },
    correlationId: input.correlationId,
  };
}
