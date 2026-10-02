import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { roleAtLocation } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import { mayCloseShift } from "../auth/policy";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import type { OperationalPolicyStore } from "../admin/operational-policy-store";
import { authorizeCheckoutRead } from "./authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";

export type RegisterClosePresentation = {
  readonly showClose: boolean;
  readonly notice: string;
};

export async function handleRegisterClosePresentation(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly registerId: string;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly policies: OperationalPolicyStore;
}): Promise<{
  readonly status: number;
  readonly body: ApiResult<RegisterClosePresentation>;
  readonly headers: CommandHttpHeaders;
}> {
  const guard = await guardStaffCommand({
    correlationIdHeader: input.correlationIdHeader,
    origin: input.origin,
    referer: input.referer,
    cookieHeader: input.cookieHeader,
    csrfHeader: input.csrfHeader,
    now: input.now,
    sessionStore: input.sessionStore,
    allowedOrigins: input.allowedOrigins,
    requireMutationProtection: false,
    requireIdempotencyKey: false,
  });
  if (!guard.ok) {
    return { status: guard.status, body: guard.body, headers: guard.headers };
  }
  const register = await input.checkoutStore.getRegister(input.registerId);
  if (!register || register.organizationId !== guard.session.organizationId) {
    const body = apiFailure("NOT_FOUND", "register is not available", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const authorized = await authorizeCheckoutRead({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: register.organizationId,
    locationId: register.locationId,
    registerId: register.id,
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }
  const assignments = await input.assignments.lookup({
    actorId: guard.session.actorId,
    organizationId: guard.session.organizationId,
  });
  if (assignments === "unavailable") {
    const body = authFailure("INTEGRATION_UNAVAILABLE", "staff assignments are unavailable", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const role = roleAtLocation(assignments, register.locationId);
  const policy = await input.policies.readEffective({
    organizationId: register.organizationId,
    locationId: register.locationId,
    registerId: register.id,
  });
  if (policy === "unavailable") {
    const body = authFailure("INTEGRATION_UNAVAILABLE", "operational close policy is unavailable", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!role) {
    const body: ApiResult<RegisterClosePresentation> = {
      ok: true,
      data: { showClose: false, notice: "This shift is closed by someone assigned to the register." },
      correlationId: guard.correlationId,
    };
    return { status: 200, body, headers: guard.headers };
  }
  const active = await input.checkoutStore.getActiveShift(register.id);
  const decision = mayCloseShift({
    role,
    actorId: guard.session.actorId,
    shiftCashierId: active?.cashierId ?? guard.session.actorId,
    varianceMinor: 0,
    policy,
  });
  const varianceNotice = role === "cashier" && policy.nonZeroVarianceRequiresManager
    ? " A cash difference outside the allowed tolerance needs a manager before the shift can close."
    : "";
  if (!decision.allowed) {
    const notice = decision.reason === "manager_cannot_close_others"
      ? "Current policy lets you close only your own shift."
      : role === "cashier"
        ? "Current policy does not let a cashier close this shift."
        : "Current policy does not let a manager close this shift.";
    return {
      status: 200,
      body: { ok: true, data: { showClose: false, notice }, correlationId: guard.correlationId },
      headers: guard.headers,
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      data: {
        showClose: true,
        notice: `You can close this shift under the current policy.${varianceNotice}`,
      },
      correlationId: guard.correlationId,
    },
    headers: guard.headers,
  };
}
