import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { STAFF_SESSION_COOKIE } from "../../config/auth";
import { parseCookieHeader } from "../auth/cookies";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import {
  resolvePaymentMethodCapabilities,
  type PaymentMethodCapabilities,
} from "./method-capabilities";

export async function handlePaymentMethodCapabilities(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly env?: Readonly<Record<string, string | undefined>>;
}): Promise<ApiResult<PaymentMethodCapabilities>> {
  const sessionId = parseCookieHeader(input.cookieHeader)[STAFF_SESSION_COOKIE];
  if (!sessionId) {
    return authFailure("AUTH_REQUIRED", "staff session is required", input.correlationId);
  }
  try {
    const stored = await input.sessions.get(sessionId, input.now);
    if (!stored) {
      return authFailure("AUTH_REQUIRED", "staff session is expired or revoked", input.correlationId);
    }
  } catch {
    return authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", input.correlationId);
  }
  return {
    ok: true,
    data: resolvePaymentMethodCapabilities(input.env),
    correlationId: input.correlationId,
  };
}
