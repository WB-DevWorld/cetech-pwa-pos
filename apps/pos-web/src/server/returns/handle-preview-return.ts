import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { ReturnPreview } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import type { ClientScopeClaim } from "../auth/authorize";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import type { ReturnStore } from "../../core/returns/types";
import { authorizeCheckoutMutation, mutationProtectionFrom } from "../sales/authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "../sales/guard-staff-command";
import { previewReturn } from "./preview";
import { isReturnPreviewRequest } from "./schema";

export async function handlePreviewReturn(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly body: unknown;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly returnStore: ReturnStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly requireApproval?: boolean;
  readonly client?: ClientScopeClaim;
}): Promise<{ readonly status: number; readonly body: ApiResult<ReturnPreview>; readonly headers: CommandHttpHeaders }> {
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
  if (!isReturnPreviewRequest(input.body)) {
    const body = authFailure("VALIDATION_ERROR", "ReturnPreviewRequest is invalid", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const sale = await input.checkoutStore.getSaleBySaleId(guard.session.organizationId, input.body.saleId);
  if (!sale) {
    const body = apiFailure("NOT_FOUND", "completed sale was not found", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const authorized = await authorizeCheckoutMutation({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: sale.organizationId,
    locationId: sale.locationId,
    registerId: sale.registerId,
    permission: "return.preview",
    protection: mutationProtectionFrom(input),
    client: input.client,
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }
  const result = await previewReturn({
    checkoutStore: input.checkoutStore,
    returnStore: input.returnStore,
    actor: guard.session,
    request: input.body,
    correlationId: guard.correlationId,
    now: input.now,
    requireApproval: input.requireApproval,
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}
