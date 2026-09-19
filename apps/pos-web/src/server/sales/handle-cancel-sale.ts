import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type { SaleResolution } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { authorizeCheckoutMutation, mutationProtectionFrom } from "./authorize-checkout";
import { cancelSale } from "./cancel-sale";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";
import { isCancelSaleRequest } from "./schema";

export type HandleCancelSaleInput = {
  readonly correlationIdHeader?: string;
  readonly origin: string | null;
  readonly referer: string | null;
  readonly cookieHeader?: string;
  readonly csrfHeader?: string | null;
  readonly idempotencyKeyHeader?: string | null;
  readonly body: unknown;
  readonly now: Date;
  readonly sessionStore: StaffSessionStore;
  readonly allowedOrigins: readonly string[];
  readonly checkoutStore: CheckoutStore;
  readonly salesPort: Pick<SalesPort, "cancel" | "resolve">;
  readonly assignments: StaffAssignmentDirectory;
};

export type HandleCancelSaleResponse = {
  readonly status: number;
  readonly body: ApiResult<SaleResolution>;
  readonly headers: CommandHttpHeaders;
};

export async function handleCancelSale(input: HandleCancelSaleInput): Promise<HandleCancelSaleResponse> {
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
    idempotencyKeyHeader: input.idempotencyKeyHeader,
    requireIdempotencyKey: true,
  });
  if (!guard.ok) {
    return { status: guard.status, body: guard.body, headers: guard.headers };
  }
  if (!isCancelSaleRequest(input.body)) {
    const body = authFailure("VALIDATION_ERROR", "CancelSaleRequest is invalid", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!guard.idempotencyKey) {
    const body = authFailure("VALIDATION_ERROR", "Idempotency-Key must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const sale = await input.checkoutStore.getSale(input.body.transactionId);
  if (!sale) {
    const body = apiFailure("NOT_FOUND", "prepared sale was not found", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const authorized = await authorizeCheckoutMutation({
    session: guard.session,
    assignments: input.assignments,
    correlationId: guard.correlationId,
    organizationId: sale.organizationId,
    locationId: sale.locationId,
    registerId: sale.registerId,
    permission: "sale.cancel",
    protection: mutationProtectionFrom(input),
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }
  const result = await cancelSale({
    store: input.checkoutStore,
    salesPort: input.salesPort,
    actor: guard.session,
    request: input.body,
    context: { idempotencyKey: guard.idempotencyKey, correlationId: guard.correlationId },
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}
