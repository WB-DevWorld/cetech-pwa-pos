import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import type { StaffAccessControl } from "../auth/staff-access-control";
import { guardStaffCommand } from "../sales/guard-staff-command";
import { authorizeCheckoutRead } from "../sales/authorize-checkout";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore } from "../../core/checkout/types";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { readPaymentProviderConfig } from "./config";
import { paystackTestCheckoutUrl } from "./paystack-presentation";

export type PaystackPresentation = {
  readonly url: string;
  readonly accessCode?: string;
  readonly displayReference?: string;
  readonly mode: "test";
};

const RESUMABLE = new Set(["awaiting_customer", "pending"]);

export async function handlePaystackPresentation(input: {
  readonly correlationId: Uuid;
  readonly cookieHeader?: string;
  readonly paymentId?: string;
  readonly now: Date;
  readonly sessions: Parameters<typeof guardStaffCommand>[0]["sessionStore"];
  readonly checkoutStore: CheckoutStore;
  readonly assignments: StaffAssignmentDirectory;
  readonly accessControl?: StaffAccessControl;
  readonly allowedOrigins?: readonly string[];
  readonly env?: Readonly<Record<string, string | undefined>>;
}): Promise<ApiResult<PaystackPresentation>> {
  const guarded = await guardStaffCommand({
    correlationIdHeader: input.correlationId,
    origin: null,
    referer: null,
    cookieHeader: input.cookieHeader,
    csrfHeader: null,
    now: input.now,
    sessionStore: input.sessions,
    accessControl: input.accessControl,
    allowedOrigins: input.allowedOrigins ?? [],
    requireMutationProtection: false,
    requireIdempotencyKey: false,
  });
  if (!guarded.ok) {
    return guarded.body;
  }
  const config = readPaymentProviderConfig(input.env ?? {});
  if (config.kind !== "paystack_test") {
    return apiFailure(
      "INTEGRATION_UNAVAILABLE",
      "Paystack test checkout is not available for this register.",
      guarded.correlationId,
    );
  }
  if (!input.paymentId) {
    return apiFailure("VALIDATION_ERROR", "paymentId is required", guarded.correlationId);
  }
  const payment = await input.checkoutStore.getPayment(input.paymentId);
  if (!payment || payment.provider !== "paystack" || !payment.providerReference) {
    return apiFailure("NOT_FOUND", "No Paystack test payment is waiting for this sale.", guarded.correlationId);
  }
  const sale = await input.checkoutStore.getSale(payment.transactionId);
  if (!sale || sale.prepared.transactionId !== payment.transactionId) {
    return apiFailure("NOT_FOUND", "No Paystack test payment is waiting for this sale.", guarded.correlationId);
  }
  const authorized = await authorizeCheckoutRead({
    session: guarded.session,
    assignments: input.assignments,
    correlationId: guarded.correlationId,
    organizationId: sale.organizationId,
    locationId: sale.locationId,
    registerId: sale.registerId,
  });
  if (!authorized.ok) {
    return authorized;
  }
  if (sale.assignedPaymentId && sale.assignedPaymentId !== payment.paymentId) {
    return apiFailure("VALIDATION_ERROR", "This checkout link does not belong to the current payment.", guarded.correlationId);
  }
  if (payment.amount.minor !== sale.prepared.total.minor || payment.amount.currency !== sale.prepared.total.currency) {
    return apiFailure("VALIDATION_ERROR", "This checkout link does not match the prepared sale.", guarded.correlationId);
  }
  if (
    sale.status === "completed" ||
    sale.status === "cancelled" ||
    sale.status === "requires_attention" ||
    Date.parse(sale.prepared.expiresAt) <= input.now.getTime()
  ) {
    return apiFailure("VALIDATION_ERROR", "This sale can no longer open a Paystack checkout.", guarded.correlationId);
  }
  if (!RESUMABLE.has(payment.status)) {
    return apiFailure(
      "VALIDATION_ERROR",
      "This payment cannot open a checkout link. Check its status instead of starting another payment.",
      guarded.correlationId,
    );
  }
  const url = paystackTestCheckoutUrl({ accessCode: payment.accessCode, authorizationUrl: payment.authorizationUrl });
  if (!url) {
    return apiFailure("INTEGRATION_UNAVAILABLE", "This payment has no allowlisted Paystack test checkout.", guarded.correlationId);
  }
  return {
    ok: true,
    data: {
      url,
      mode: "test",
      ...(payment.accessCode ? { accessCode: payment.accessCode } : {}),
      ...(payment.displayReference ? { displayReference: payment.displayReference } : {}),
    },
    correlationId: guarded.correlationId,
  };
}
