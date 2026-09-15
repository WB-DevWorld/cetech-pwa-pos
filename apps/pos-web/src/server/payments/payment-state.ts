import type { PaymentState } from "../../../../../docs/contracts/domain.generated";
import type { StoredPayment } from "../../core/checkout/types";

export function toPaymentState(payment: StoredPayment): PaymentState {
  const displayReference = payment.displayReference ?? payment.providerReference;
  if (payment.status === "verified") {
    if (!payment.verifiedAt) {
      throw new Error("verified payment is missing verifiedAt");
    }
    return {
      transactionId: payment.transactionId,
      paymentId: payment.paymentId,
      tender: payment.tender,
      status: "verified",
      amount: payment.amount,
      verifiedAt: payment.verifiedAt,
      nextAction: "none",
      ...(displayReference ? { displayReference } : {}),
    };
  }
  return {
    transactionId: payment.transactionId,
    paymentId: payment.paymentId,
    tender: payment.tender,
    status: payment.status,
    amount: payment.amount,
    nextAction: nextActionFor(payment.status),
    ...(payment.verifiedAt ? { verifiedAt: payment.verifiedAt } : {}),
    ...(displayReference ? { displayReference } : {}),
  };
}

function nextActionFor(status: StoredPayment["status"]): PaymentState["nextAction"] {
  if (status === "requires_attention") {
    return "contact_manager";
  }
  if (status === "failed" || status === "cancelled") {
    return "none";
  }
  if (status === "awaiting_customer") {
    return "present_payment";
  }
  return "resolve";
}
