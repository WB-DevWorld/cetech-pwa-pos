import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type { SaleResolution } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { isUuid } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { authorizeCheckoutRead } from "./authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";
import { resolveSale } from "./resolve-sale";

export type HandleResolveSaleInput = {
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
  readonly salesPort: Pick<SalesPort, "resolve">;
  readonly assignments: StaffAssignmentDirectory;
};

export type HandleResolveSaleResponse = {
  readonly status: number;
  readonly body: ApiResult<SaleResolution>;
  readonly headers: CommandHttpHeaders;
};

export async function handleResolveSale(input: HandleResolveSaleInput): Promise<HandleResolveSaleResponse> {
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
  let actor = guard.session;
  const sale = await input.checkoutStore.getSale(input.transactionId);
  if (sale) {
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
    actor = authorized.data.session;
  } else {
    const binding = await input.checkoutStore.lookupCommandScope({
      transactionId: input.transactionId,
      operation: "sale.prepare",
    });
    if (binding?.registerId) {
      const authorized = await authorizeCheckoutRead({
        session: guard.session,
        assignments: input.assignments,
        correlationId: guard.correlationId,
        organizationId: binding.organizationId,
        locationId: binding.locationId,
        registerId: binding.registerId,
      });
      if (!authorized.ok) {
        return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
      }
      actor = authorized.data.session;
    }
  }
  const result = await resolveSale({
    store: input.checkoutStore,
    salesPort: input.salesPort,
    actor,
    transactionId: input.transactionId,
    correlationId: guard.correlationId,
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}
