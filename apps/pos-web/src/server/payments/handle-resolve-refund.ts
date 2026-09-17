import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { RefundState, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { ClientScopeClaim } from "../auth/authorize";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import { isUuid } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import type { ReturnStore } from "../../core/returns/types";
import { resolveTenderRefund } from "./refund";
import type { ElectronicRefundProvider } from "./refund-provider";
import { authorizeCheckoutMutation, mutationProtectionFrom } from "../sales/authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "../sales/guard-staff-command";

export async function handleResolveRefund(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly refundId: string;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly returnStore: ReturnStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly provider: ElectronicRefundProvider;
  readonly client?: ClientScopeClaim;
}): Promise<{ readonly status: number; readonly body: ApiResult<RefundState>; readonly headers: CommandHttpHeaders }> {
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
  if (!isUuid(input.refundId)) {
    const body = authFailure("VALIDATION_ERROR", "refundId must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const refund = await input.returnStore.getTenderRefund(input.refundId as Uuid);
  if (!refund) {
    const body = apiFailure("NOT_FOUND", "refund was not found", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const storedReturn = await input.returnStore.getReturn(refund.returnId);
  if (!storedReturn) {
    const body = apiFailure("NOT_FOUND", "return was not found for refund", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const authorized = await authorizeCheckoutMutation({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: refund.organizationId,
    locationId: refund.locationId,
    registerId: storedReturn.registerId,
    permission: "refund.resolve",
    protection: mutationProtectionFrom(input),
    client: input.client,
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }
  const result = await resolveTenderRefund({
    checkoutStore: input.checkoutStore,
    returnStore: input.returnStore,
    provider: input.provider,
    actor: guard.session,
    refundId: input.refundId,
    correlationId: guard.correlationId,
    now: input.now,
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}
