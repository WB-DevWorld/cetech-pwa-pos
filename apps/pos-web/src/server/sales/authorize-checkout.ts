import type { Session } from "../../../../../docs/contracts/domain.generated";
import { STAFF_CSRF_COOKIE } from "../../config/auth";
import {
  authorizeStaffMutation,
  authorizeStaffRead,
  type AuthorizedStaffContext,
} from "../auth/authorize";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { parseCookieHeader } from "../auth/cookies";
import type { MutationProtectionInput } from "../auth/csrf";
import type { IdentityVerifyResult } from "../auth/identity-verifier";
import type { StaffPermission } from "../auth/roles";
import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";

export function identityFromSession(session: Session): IdentityVerifyResult {
  return {
    ok: true,
    identity: {
      actorId: session.actorId,
      displayName: session.displayName,
      organizationId: session.organizationId,
      locationIds: [...session.locationIds],
      registerId: null,
      capabilities: [...session.capabilities],
      expiresAt: session.expiresAt,
    },
  };
}

export function mutationProtectionFrom(input: {
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly allowedOrigins: readonly string[];
}): MutationProtectionInput {
  return {
    origin: input.origin,
    referer: input.referer,
    csrfCookie: parseCookieHeader(input.cookieHeader)[STAFF_CSRF_COOKIE] ?? null,
    csrfHeader: input.csrfHeader ?? null,
    allowedOrigins: input.allowedOrigins,
  };
}

export async function authorizeCheckoutMutation(input: {
  readonly session: Session;
  readonly assignments: StaffAssignmentDirectory;
  readonly correlationId: Uuid;
  readonly organizationId: string;
  readonly locationId: string;
  readonly registerId: string;
  readonly permission: Extract<StaffPermission, "shift.open" | "payment.cash" | "sale.finalize">;
  readonly protection: MutationProtectionInput;
}): Promise<ApiResult<AuthorizedStaffContext>> {
  return authorizeStaffMutation(
    {
      verifyResult: identityFromSession(input.session),
      assignments: input.assignments,
      correlationId: input.correlationId,
      required: {
        organizationId: input.organizationId,
        locationId: input.locationId,
        registerId: input.registerId,
        permission: input.permission,
      },
    },
    input.protection,
  );
}

export async function authorizeCheckoutRead(input: {
  readonly session: Session;
  readonly assignments: StaffAssignmentDirectory;
  readonly correlationId: Uuid;
  readonly organizationId: string;
  readonly locationId: string;
  readonly registerId: string;
}): Promise<ApiResult<AuthorizedStaffContext>> {
  return authorizeStaffRead({
    verifyResult: identityFromSession(input.session),
    assignments: input.assignments,
    correlationId: input.correlationId,
    required: {
      organizationId: input.organizationId,
      locationId: input.locationId,
      registerId: input.registerId,
    },
  });
}
