import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { isUuid } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { authorizeCheckoutRead } from "../sales/authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "../sales/guard-staff-command";
import { presentOrderHistoryItem, type OrderHistoryListItem } from "./order-history-view";

export async function handleGetOrder(input: {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly transactionId: string;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly assignments: StaffAssignmentDirectory;
}): Promise<{
  readonly status: number;
  readonly body: ApiResult<OrderHistoryListItem>;
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
  if (!isUuid(input.transactionId)) {
    const body = authFailure("VALIDATION_ERROR", "transactionId must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const sale = await input.checkoutStore.getSale(input.transactionId);
  if (!sale || sale.organizationId !== guard.session.organizationId) {
    const body = apiFailure("NOT_FOUND", "sale was not found", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const authorized = await authorizeCheckoutRead({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: sale.organizationId,
    locationId: sale.locationId,
    registerId: sale.registerId,
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }
  const payment = await input.checkoutStore.getPaymentForTransaction(sale.prepared.transactionId);
  return {
    status: 200,
    body: { ok: true, data: presentOrderHistoryItem(sale, payment), correlationId: guard.correlationId },
    headers: guard.headers,
  };
}
