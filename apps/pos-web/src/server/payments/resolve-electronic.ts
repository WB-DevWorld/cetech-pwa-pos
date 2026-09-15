import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { CommandContext, PaymentLookup, PaymentState } from "../../../../../docs/contracts/domain.generated";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, StaffActor, StoredPayment } from "../../core/checkout/types";
import { applyProviderVerification } from "./apply-verification";
import { toPaymentState } from "./payment-state";
import type { ElectronicPaymentProvider } from "./provider";

export async function resolveElectronicPayment(input: {
  readonly store: CheckoutStore;
  readonly provider: ElectronicPaymentProvider;
  readonly actor: StaffActor;
  readonly request: PaymentLookup;
  readonly context: Pick<CommandContext, "correlationId">;
  readonly now: Date;
}): Promise<ApiResult<PaymentState>> {
  const { store, provider, actor, request, context, now } = input;
  const sale = await store.getSale(request.transactionId);
  if (!sale) {
    return apiFailure("NOT_FOUND", "prepared sale was not found", context.correlationId);
  }
  if (sale.organizationId !== actor.organizationId) {
    return apiFailure("FORBIDDEN", "sale organization is out of staff scope", context.correlationId);
  }
  if (!actor.locationIds.includes(sale.locationId)) {
    return apiFailure("FORBIDDEN", "sale location is out of staff scope", context.correlationId);
  }

  const payment = request.paymentId
    ? await store.getPayment(request.paymentId)
    : await store.getPaymentForTransaction(request.transactionId);
  if (!payment) {
    return apiFailure("NOT_FOUND", "payment intent was not found", context.correlationId);
  }
  if (payment.transactionId !== request.transactionId) {
    return apiFailure("PAYMENT_NOT_VERIFIED", "payment is not verified for this sale", context.correlationId);
  }

  if (payment.tender === "cash") {
    if (payment.status !== "verified" || !payment.verifiedAt) {
      return apiFailure("PAYMENT_NOT_VERIFIED", "cash payment is not verified", context.correlationId);
    }
    return { ok: true, data: toPaymentState(payment), correlationId: context.correlationId };
  }

  if (!payment.providerReference) {
    return apiFailure("REQUIRES_ATTENTION", "electronic payment is missing a provider reference", context.correlationId);
  }

  const verification = await provider.verify(payment.providerReference);
  const resolved = await applyProviderVerification({ store, sale, payment, verification, now });
  return { ok: true, data: toPaymentState(resolved), correlationId: context.correlationId };
}

export async function resolveStoredElectronic(input: {
  readonly store: CheckoutStore;
  readonly provider: ElectronicPaymentProvider;
  readonly payment: StoredPayment;
  readonly now: Date;
}): Promise<StoredPayment> {
  const sale = await input.store.getSale(input.payment.transactionId);
  if (!sale || !input.payment.providerReference) {
    return input.payment;
  }
  const verification = await input.provider.verify(input.payment.providerReference);
  return applyProviderVerification({
    store: input.store,
    sale,
    payment: input.payment,
    verification,
    now: input.now,
  });
}
