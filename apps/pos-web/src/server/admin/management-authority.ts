import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { STAFF_SESSION_COOKIE } from "../../config/auth";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { parseCookieHeader } from "../auth/cookies";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import type { ControlPlaneDirectory } from "./control-plane-directory";
import { resolveManagementSections, type ManagementContext } from "./management-context";

export async function loadManagementAuthority(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly controlPlane: ControlPlaneDirectory;
}): Promise<ApiResult<ManagementContext>> {
  const cookies = parseCookieHeader(input.cookieHeader);
  const sessionId = cookies[STAFF_SESSION_COOKIE];
  if (!sessionId) {
    return authFailure("AUTH_REQUIRED", "staff session is required", input.correlationId);
  }

  let stored;
  try {
    stored = await input.sessions.get(sessionId, input.now);
  } catch {
    return authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", input.correlationId);
  }
  if (!stored) {
    return authFailure("AUTH_REQUIRED", "staff session is expired or revoked", input.correlationId);
  }
  if (stored.mustChangePassword === true) {
    return authFailure("FORBIDDEN", "Create a new password before continuing.", input.correlationId);
  }

  const session = stored.session;
  const assignmentResult = await input.assignments.lookup({
    actorId: session.actorId,
    organizationId: session.organizationId,
  });
  if (assignmentResult === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "staff assignment directory is unavailable", input.correlationId);
  }

  const membership = await input.controlPlane.lookup({
    actorId: session.actorId,
    organizationId: session.organizationId,
  });
  if (membership === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "management authority directory is unavailable", input.correlationId);
  }

  const controlRole = membership?.status === "active" ? membership.controlRole : null;
  const verifiedLocations = new Set(session.locationIds);
  const locationRoles = assignmentResult.locationRoles.filter((row) =>
    verifiedLocations.has(row.locationId),
  );
  const sections = resolveManagementSections({ controlRole, locationRoles });
  if (sections.length === 0) {
    return authFailure("FORBIDDEN", "staff is not authorized for management", input.correlationId);
  }

  return {
    ok: true,
    data: {
      actorId: session.actorId,
      displayName: session.displayName,
      organizationId: session.organizationId,
      controlRole,
      managerLocationIds: locationRoles
        .filter((row) => row.role === "manager")
        .map((row) => row.locationId),
      locationRoles,
      sections,
    },
    correlationId: input.correlationId,
  };
}
