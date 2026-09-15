import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { PaymentState } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { toPaymentState } from "../payments/payment-state";
import type { ElectronicPaymentProvider } from "../payments/provider";
import { resolveElectronicPayment } from "../payments/resolve-electronic";
import { authorizeCheckoutMutation, mutationProtectionFrom } from "./authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "./guard-staff-command";
import { isPaymentLookup, isPaymentState } from "./schema";

export type HandleResolvePaymentInput = {
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
  readonly assignments: StaffAssignmentDirectory;
  readonly provider?: ElectronicPaymentProvider;
};

export type HandleResolvePaymentResponse = {
  readonly status: number;
  readonly body: ApiResult<PaymentState>;
  readonly headers: CommandHttpHeaders;
};

export async function handleResolvePayment(input: HandleResolvePaymentInput): Promise<HandleResolvePaymentResponse> {
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
  if (!isPaymentLookup(input.body)) {
    const body = authFailure("VALIDATION_ERROR", "PaymentLookup is invalid", guard.correlationId);
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
    permission: "payment.resolve",
    protection: mutationProtectionFrom(input),
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }

  const payment = input.body.paymentId
    ? await input.checkoutStore.getPayment(input.body.paymentId)
    : await input.checkoutStore.getPaymentForTransaction(input.body.transactionId);
  if (payment && payment.transactionId !== input.body.transactionId) {
    const body = apiFailure("PAYMENT_NOT_VERIFIED", "payment is not verified for this sale", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!payment) {
    const state = missingCashState(input.body.transactionId);
    return { status: 200, body: { ok: true, data: state, correlationId: guard.correlationId }, headers: guard.headers };
  }
  if (payment.tender !== "cash") {
    if (!input.provider) {
      const state = toPaymentState(payment);
      return { status: 200, body: { ok: true, data: state, correlationId: guard.correlationId }, headers: guard.headers };
    }
    const resolved = await resolveElectronicPayment({
      store: input.checkoutStore,
      provider: input.provider,
      actor: guard.session,
      request: input.body,
      context: { correlationId: guard.correlationId },
      now: input.now,
    });
    return {
      status: resolved.ok ? 200 : httpStatusFor(resolved.error.code),
      body: resolved,
      headers: guard.headers,
    };
  }
  const state = toPaymentState(payment);
  if (!isPaymentState(state)) {
    const body = apiFailure("INTEGRATION_UNAVAILABLE", "stored payment is not a valid PaymentState", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  return { status: 200, body: { ok: true, data: state, correlationId: guard.correlationId }, headers: guard.headers };
}

function missingCashState(transactionId: PaymentState["transactionId"]): PaymentState {
  return {
    transactionId,
    paymentId: "00000000-0000-4000-8000-000000000000",
    tender: "cash",
    status: "failed",
    amount: { minor: 0, currency: "GHS" },
    nextAction: "none",
  };
}
