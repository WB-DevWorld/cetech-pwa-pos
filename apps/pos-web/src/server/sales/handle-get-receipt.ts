import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { ReceiptSnapshot } from "../../../../../docs/contracts/domain.generated";
import { authFailure } from "../auth/errors";
import { isUuid } from "../auth/ids";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { getReceiptByTransaction } from "./get-receipt";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";

export type HandleGetReceiptInput = {
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
};

export type HandleGetReceiptResponse = {
  readonly status: number;
  readonly body: ApiResult<ReceiptSnapshot>;
  readonly headers: CommandHttpHeaders;
};

export async function handleGetReceipt(input: HandleGetReceiptInput): Promise<HandleGetReceiptResponse> {
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
  const result = await getReceiptByTransaction({
    store: input.checkoutStore,
    actor: guard.session,
    transactionId: input.transactionId,
    context: { correlationId: guard.correlationId },
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}
