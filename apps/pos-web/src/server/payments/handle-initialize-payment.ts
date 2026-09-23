import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { PaymentState } from "../../../../../docs/contracts/domain.generated";
import type { StaffAssignmentDirectory } from "../auth/assignments";
import { authFailure } from "../auth/errors";
import { apiFailure } from "../http/api-failure";
import type { StaffSessionStore } from "../auth/session-store";
import { httpStatusFor } from "../http/status";
import type { CheckoutStore } from "../../core/checkout/types";
import { authorizeCheckoutMutation, mutationProtectionFrom } from "../sales/authorize-checkout";
import { guardStaffCommand, type CommandHttpHeaders } from "../sales/guard-staff-command";
import { isInitializePaymentRequest } from "../sales/schema";
import { initializeElectronicPayment } from "./initialize-electronic";
import type { ElectronicPaymentProvider } from "./provider";
import { readPaymentProviderConfig } from "./config";
import { capabilityForElectronicTender, resolvePaymentMethodCapabilities } from "./method-capabilities";

export type HandleInitializePaymentInput = {
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
  readonly assignments: StaffAssignmentDirectory;
  readonly provider?: ElectronicPaymentProvider;
  readonly appEnv?: string;
  readonly sandboxPayerEmail?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
};

export type HandleInitializePaymentResponse = {
  readonly status: number;
  readonly body: ApiResult<PaymentState>;
  readonly headers: CommandHttpHeaders;
};

export async function handleInitializePayment(input: HandleInitializePaymentInput): Promise<HandleInitializePaymentResponse> {
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
  if (!isInitializePaymentRequest(input.body)) {
    const body = authFailure("VALIDATION_ERROR", "InitializePaymentRequest is invalid", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }
  if (!guard.idempotencyKey) {
    const body = authFailure("VALIDATION_ERROR", "Idempotency-Key must be a UUID", guard.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const config = readPaymentProviderConfig(input.env ?? {});
  if (config.kind === "blocked_live" || config.kind === "blocked_unsafe") {
    const body = apiFailure(
      "INTEGRATION_UNAVAILABLE",
      config.kind === "blocked_live"
        ? "electronic payment is not authorized in live mode"
        : "electronic payment requires a Paystack test secret",
      guard.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const capabilities = resolvePaymentMethodCapabilities(input.env ?? {});
  const methodCapability = capabilityForElectronicTender(capabilities, input.body.tender);
  if (methodCapability !== "configured") {
    const body = apiFailure(
      "INTEGRATION_UNAVAILABLE",
      "the selected electronic payment method is not configured",
      guard.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers: guard.headers };
  }

  const provider = input.provider;
  if (!provider) {
    const body = apiFailure("INTEGRATION_UNAVAILABLE", "electronic payment provider is not configured", guard.correlationId);
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
    permission: "payment.initialize",
    protection: mutationProtectionFrom(input),
  });
  if (!authorized.ok) {
    return { status: httpStatusFor(authorized.error.code), body: authorized, headers: guard.headers };
  }

  const result = await initializeElectronicPayment({
    store: input.checkoutStore,
    provider,
    actor: guard.session,
    request: input.body,
    context: { idempotencyKey: guard.idempotencyKey, correlationId: guard.correlationId },
    now: input.now,
    appEnv: input.appEnv ?? "local",
    sandboxPayerEmail: input.sandboxPayerEmail ?? (config.kind === "paystack_test" ? config.sandboxPayerEmail : undefined),
  });
  return { status: result.ok ? 200 : httpStatusFor(result.error.code), body: result, headers: guard.headers };
}
