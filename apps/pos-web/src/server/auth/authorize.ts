import type { ApiResult, ApiSuccess } from "../../../../../docs/contracts/ports";
import type { Session, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "./assignments";
import { toSession, type StaffIdentityClaims } from "./claims";
import { assertMutationProtection, type MutationProtectionInput } from "./csrf";
import { authFailure } from "./errors";
import type { IdentityVerifyResult } from "./identity-verifier";

export type AuthorizedStaffContext = {
  readonly session: Session;
  readonly identity: StaffIdentityClaims;
  readonly locationId?: string;
  readonly registerId?: string;
};

export type ClientScopeClaim = {
  readonly actorId?: string;
  readonly organizationId?: string;
  readonly locationId?: string;
  readonly registerId?: string;
  readonly capabilities?: readonly string[];
  readonly customerId?: string;
};

export type AuthorizeStaffActionInput = {
  readonly verifyResult: IdentityVerifyResult;
  readonly assignments: StaffAssignmentDirectory;
  readonly correlationId: Uuid;
  readonly required: {
    readonly organizationId: string;
    readonly locationId?: string;
    readonly registerId?: string;
    /** Server-side permission name. Never taken from client capabilities. */
    readonly permission?: string;
    readonly permittedServerCapabilities?: readonly string[];
  };
  readonly client?: ClientScopeClaim;
  readonly mutation?: MutationProtectionInput;
};

export async function authorizeStaffAction(
  input: AuthorizeStaffActionInput,
): Promise<ApiResult<AuthorizedStaffContext>> {
  const { correlationId } = input;
  if (!input.verifyResult.ok) {
    return identityFailure(input.verifyResult.reason, correlationId);
  }
  const identity = input.verifyResult.identity;

  if (input.mutation) {
    const protection = assertMutationProtection(input.mutation);
    if (!protection.ok) {
      return authFailure(
        "FORBIDDEN",
        protection.reason === "csrf"
          ? "mutation requires matching CSRF cookie and header"
          : "mutation origin is not allowed",
        correlationId,
      );
    }
  }

  if (isSpoofed(identity, input.client)) {
    return authFailure("FORBIDDEN", "client-supplied actor or scope does not match verified identity", correlationId);
  }
  if (input.client?.customerId) {
    return authFailure("FORBIDDEN", "buyer customer context is not staff identity", correlationId);
  }

  if (identity.organizationId !== input.required.organizationId) {
    return authFailure("FORBIDDEN", "organization is out of staff scope", correlationId);
  }

  const assignments = await input.assignments.lookup({
    actorId: identity.actorId,
    organizationId: identity.organizationId,
  });
  if (assignments === "unavailable") {
    return authFailure("INTEGRATION_UNAVAILABLE", "staff assignment directory is unavailable", correlationId);
  }

  const locationId = input.required.locationId;
  if (locationId) {
    if (!identity.locationIds.includes(locationId) || !assignments.locationIds.includes(locationId)) {
      return authFailure("FORBIDDEN", "location is out of staff scope", correlationId);
    }
  }

  const registerId = input.required.registerId;
  if (registerId) {
    if (identity.registerId && identity.registerId !== registerId) {
      return authFailure("FORBIDDEN", "register is not assigned to this staff session", correlationId);
    }
    if (!assignments.registerIds.includes(registerId)) {
      return authFailure("FORBIDDEN", "register is not assigned to this staff session", correlationId);
    }
  }

  if (input.required.permission) {
    const allowed = input.required.permittedServerCapabilities ?? [];
    if (!allowed.includes(input.required.permission)) {
      return authFailure("FORBIDDEN", "staff is not permitted to perform this action", correlationId);
    }
  }

  const session = toSession(identity);
  const success: ApiSuccess<AuthorizedStaffContext> = {
    ok: true,
    data: {
      session,
      identity,
      ...(locationId ? { locationId } : {}),
      ...(registerId ? { registerId } : {}),
    },
    correlationId,
  };
  return success;
}

function identityFailure(
  reason: Exclude<IdentityVerifyResult, { ok: true }>["reason"],
  correlationId: Uuid,
) {
  switch (reason) {
    case "anonymous":
      return authFailure("AUTH_REQUIRED", "anonymous requests are denied", correlationId);
    case "expired":
      return authFailure("AUTH_REQUIRED", "session is expired", correlationId);
    case "revoked":
      return authFailure("AUTH_REQUIRED", "identity verification was revoked", correlationId);
    case "malformed":
      return authFailure("AUTH_REQUIRED", "identity claims are malformed", correlationId);
    case "timeout":
    case "unavailable":
      return authFailure("INTEGRATION_UNAVAILABLE", "identity provider is unavailable", correlationId);
  }
}

function isSpoofed(identity: StaffIdentityClaims, client: ClientScopeClaim | undefined): boolean {
  if (!client) {
    return false;
  }
  if (client.actorId !== undefined && client.actorId !== identity.actorId) {
    return true;
  }
  if (client.organizationId !== undefined && client.organizationId !== identity.organizationId) {
    return true;
  }
  if (client.locationId !== undefined && !identity.locationIds.includes(client.locationId)) {
    return true;
  }
  if (
    client.registerId !== undefined &&
    identity.registerId !== null &&
    client.registerId !== identity.registerId
  ) {
    return true;
  }
  return false;
}
