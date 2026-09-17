import type { ApiResult, BridgeReturnEffectsPort } from "../../../../../docs/contracts/ports";
import type { ReturnResolution, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { ClientScopeClaim } from "../auth/authorize";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import { isUuid } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import type { ReturnStore } from "../../core/returns/types";
import type { ElectronicRefundProvider } from "../payments/refund-provider";
import { authorizeCheckoutMutation, mutationProtectionFrom } from "../sales/authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "../sales/guard-staff-command";
import { resolveReturn } from "./resolve";

export async function handleResolveReturn(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly returnId: string;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly returnStore: ReturnStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly provider: ElectronicRefundProvider;
  readonly bridge: BridgeReturnEffectsPort;
  readonly client?: ClientScopeClaim;
}): Promise<{ readonly status: number; readonly body: ApiResult<ReturnResolution>; readonly headers: CommandHttpHeaders }> {
  const guard = await guardStaffCommand({
    correlationIdHeader: input.correlationIdHeader,
    origin: input.origin,
    referer: input.referer,
    cookieHeader: input.cookieHeader,
    csrfHeader: input.csrfHeader,
    now: input.now,
    sessionStore: input.sessionStore,
    allowedOrigins: input.allowedOrigins,
    requireMutationProtection: true,
    requireIdempotencyKey: false,
  });
  if (!guard.ok) {
    return { status: guard.status, body: guard.body, headers: guard.headers };
  }
  if (!isUuid(input.returnId)) {
    const body = authFailure("VALIDATION_ERROR", "returnId must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const stored = await input.returnStore.getReturn(input.returnId as Uuid);
  if (!stored) {
    const body = apiFailure("NOT_FOUND", "return was not found", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const authorized = await authorizeCheckoutMutation({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: stored.organizationId,
    locationId: stored.locationId,
    registerId: stored.registerId,
    permission: "return.resolve",
    protection: mutationProtectionFrom(input),
    client: input.client,
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }
  const result = await resolveReturn({
    checkoutStore: input.checkoutStore,
    returnStore: input.returnStore,
    provider: input.provider,
    bridge: input.bridge,
    actor: guard.session,
    returnId: input.returnId,
    correlationId: guard.correlationId,
    now: input.now,
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}
