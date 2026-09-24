import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { STAFF_SESSION_COOKIE } from "../../config/auth";
import { assertMutationProtection, type MutationProtectionInput } from "./csrf";
import { parseCookieHeader } from "./cookies";
import { authFailure } from "./errors";
import { temporaryPasswordError } from "./password-policy";
import type { StaffSessionStore } from "./session-store";
import type { StaffIdentityAdminStore } from "../admin/staff-identity-admin-store";

export async function handleChangeRequiredPassword(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly identities: StaffIdentityAdminStore;
  readonly password: string;
  readonly protection: MutationProtectionInput;
}): Promise<ApiResult<{ readonly passwordChanged: true }>> {
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
  const passwordError = temporaryPasswordError(input.password);
  if (passwordError) {
    return authFailure("VALIDATION_ERROR", passwordError, input.correlationId);
  }
  const sessionId = parseCookieHeader(input.cookieHeader)[STAFF_SESSION_COOKIE];
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
  if (stored.mustChangePassword !== true) {
    return authFailure("FORBIDDEN", "A password change is not required for this sign-in.", input.correlationId);
  }
  if (!stored.authUserId) {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "Sign out and sign in again before choosing a new password.",
      input.correlationId,
    );
  }
  const replaced = await input.identities.replaceOwnPassword({
    authUserId: stored.authUserId,
    password: input.password,
  });
  if (replaced !== "ok") {
    return authFailure("INTEGRATION_UNAVAILABLE", "The new password could not be saved.", input.correlationId);
  }
  try {
    await input.sessions.revokeActorSessions({
      organizationId: stored.session.organizationId,
      actorId: stored.session.actorId,
    });
  } catch {
    return authFailure(
      "INTEGRATION_UNAVAILABLE",
      "The password was saved, but old sign-ins could not be closed. Sign out on every device.",
      input.correlationId,
    );
  }
  return {
    ok: true,
    data: { passwordChanged: true },
    correlationId: input.correlationId,
  };
}
