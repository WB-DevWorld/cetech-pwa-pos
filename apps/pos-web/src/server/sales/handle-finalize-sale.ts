import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type { SaleResolution } from "../../../../../docs/contracts/domain.generated";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { finalizeSale } from "./finalize-sale";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";
import { isFinalizeSaleRequest } from "./schema";

export type HandleFinalizeSaleInput = {
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
  readonly salesPort: Pick<SalesPort, "confirmPayment">;
};

export type HandleFinalizeSaleResponse = {
  readonly status: number;
  readonly body: ApiResult<SaleResolution>;
  readonly headers: CommandHttpHeaders;
};

export async function handleFinalizeSale(input: HandleFinalizeSaleInput): Promise<HandleFinalizeSaleResponse> {
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
  if (!isFinalizeSaleRequest(input.body)) {
    const body = authFailure("VALIDATION_ERROR", "FinalizeSaleRequest is invalid", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!guard.idempotencyKey) {
    const body = authFailure("VALIDATION_ERROR", "Idempotency-Key must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const result = await finalizeSale({
    store: input.checkoutStore,
    salesPort: input.salesPort,
    actor: guard.session,
    request: input.body,
    context: { idempotencyKey: guard.idempotencyKey, correlationId: guard.correlationId },
    now: input.now,
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}
