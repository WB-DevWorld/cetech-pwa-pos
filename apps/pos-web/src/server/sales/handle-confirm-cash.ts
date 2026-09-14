import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { PaymentState } from "../../../../../docs/contracts/domain.generated";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { confirmCash } from "./confirm-cash";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";
import { isCashPaymentRequest } from "./schema";

export type HandleConfirmCashInput = {
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
};

export type HandleConfirmCashResponse = {
  readonly status: number;
  readonly body: ApiResult<PaymentState>;
  readonly headers: CommandHttpHeaders;
};

export async function handleConfirmCash(input: HandleConfirmCashInput): Promise<HandleConfirmCashResponse> {
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
  if (!isCashPaymentRequest(input.body)) {
    const body = authFailure("VALIDATION_ERROR", "CashPaymentRequest is invalid", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!guard.idempotencyKey) {
    const body = authFailure("VALIDATION_ERROR", "Idempotency-Key must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  const result = await confirmCash({
    store: input.checkoutStore,
    actor: guard.session,
    request: input.body,
    context: { idempotencyKey: guard.idempotencyKey, correlationId: guard.correlationId },
    now: input.now,
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}
