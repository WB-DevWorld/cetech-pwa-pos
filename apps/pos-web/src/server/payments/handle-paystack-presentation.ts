import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { STAFF_SESSION_COOKIE } from "../../config/auth";
import { parseCookieHeader } from "../auth/cookies";
import { authFailure } from "../auth/errors";
import type { StaffSessionStore } from "../auth/session-store";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore } from "../../core/checkout/types";
import { paystackModeSelection } from "./config";
import { paystackTestCheckoutUrl } from "./paystack-presentation";

export type PaystackPresentation = {
  readonly url: string;
  readonly accessCode?: string;
  readonly displayReference?: string;
  readonly mode: "test";
};

export async function handlePaystackPresentation(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly paymentId?: string;
  readonly now: Date;
  readonly sessions: StaffSessionStore;
  readonly checkoutStore: CheckoutStore;
  readonly env?: Readonly<Record<string, string | undefined>>;
}): Promise<ApiResult<PaystackPresentation>> {
  const sessionId = parseCookieHeader(input.cookieHeader)[STAFF_SESSION_COOKIE];
  if (!sessionId) return authFailure("AUTH_REQUIRED", "staff session is required", input.correlationId);
  let stored: Awaited<ReturnType<StaffSessionStore["get"]>>;
  try {
    stored = await input.sessions.get(sessionId, input.now);
  } catch {
    return authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", input.correlationId);
  }
  if (!stored) return authFailure("AUTH_REQUIRED", "staff session is expired or revoked", input.correlationId);
  const mode = paystackModeSelection(input.env ?? {});
  if (mode.mode === "live") {
    return apiFailure("INTEGRATION_UNAVAILABLE", "Live Paystack checkout stays blocked.", input.correlationId);
  }
  if (!input.paymentId) return apiFailure("VALIDATION_ERROR", "paymentId is required", input.correlationId);
  const payment = await input.checkoutStore.getPayment(input.paymentId);
  if (!payment || payment.provider !== "paystack") {
    return apiFailure("NOT_FOUND", "No Paystack test payment is waiting for this sale.", input.correlationId);
  }
  const sale = await input.checkoutStore.getSale(payment.transactionId);
  if (
    !sale ||
    sale.organizationId !== stored.session.organizationId ||
    !stored.session.locationIds.includes(sale.locationId)
  ) {
    return apiFailure("FORBIDDEN", "This payment is outside the current staff session.", input.correlationId);
  }
  const url = paystackTestCheckoutUrl({ accessCode: payment.accessCode, authorizationUrl: payment.authorizationUrl });
  if (!url) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "This payment has no allowlisted Paystack test checkout.", input.correlationId);
  }
  return {
    ok: true,
    data: {
      url,
      mode: "test",
      ...(payment.accessCode ? { accessCode: payment.accessCode } : {}),
      ...(payment.displayReference ? { displayReference: payment.displayReference } : {}),
    },
    correlationId: input.correlationId,
  };
}
