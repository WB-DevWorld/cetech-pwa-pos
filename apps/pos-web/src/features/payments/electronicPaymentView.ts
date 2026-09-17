/**
 * FE-06 electronic payment presentation. Discriminants match frozen PaymentState
 * for cashier copy only; they are not PaymentPort and not provider truth.
 */

export type ElectronicTenderView = "mobile_money" | "card" | "external_electronic";

export type PaymentStatusView =
  | "idle"
  | "initializing"
  | "awaiting_customer"
  | "pending"
  | "reconciling"
  | "verified"
  | "cancelled"
  | "failed"
  | "requires_attention";

export type PaymentNextActionView = "wait" | "resolve" | "present_payment" | "none" | "contact_manager";

export type PaymentMoneyView = {
  readonly minor: number;
  readonly currency: string;
};

export type ElectronicPaymentSessionView = {
  readonly status: PaymentStatusView;
  readonly nextAction: PaymentNextActionView;
  readonly transactionId?: string;
  readonly paymentId?: string;
  readonly tender?: ElectronicTenderView;
  readonly amount?: PaymentMoneyView;
  readonly displayReference?: string;
  readonly message: string;
  readonly warning?: string;
  readonly doNotChargeAgain: boolean;
  readonly verified: boolean;
  readonly presentAllowed: boolean;
  readonly resolveAllowed: boolean;
  readonly contactManager: boolean;
  readonly browserCallbackIsNotTruth: boolean;
};

export const DO_NOT_CHARGE_AGAIN = "Do not charge again.";

export function idleElectronicPaymentSession(): ElectronicPaymentSessionView {
  return {
    status: "idle",
    nextAction: "present_payment",
    message: "Present electronic payment only when the server asks to present payment.",
    doNotChargeAgain: false,
    verified: false,
    presentAllowed: true,
    resolveAllowed: false,
    contactManager: false,
    browserCallbackIsNotTruth: false,
  };
}

export function paymentInstructsWaitOrResolve(
  status: PaymentStatusView,
  nextAction: PaymentNextActionView,
): boolean {
  if (nextAction === "wait" || nextAction === "resolve") {
    return true;
  }
  return status === "pending" || status === "reconciling";
}

export function describeElectronicPayment(
  status: PaymentStatusView,
  nextAction: PaymentNextActionView,
): {
  readonly title: string;
  readonly message: string;
  readonly warning?: string;
  readonly doNotChargeAgain: boolean;
  readonly contactManager: boolean;
  readonly presentAllowed: boolean;
  readonly resolveAllowed: boolean;
  readonly verified: boolean;
} {
  const waitOrResolve = paymentInstructsWaitOrResolve(status, nextAction);
  if (status === "verified") {
    return {
      title: "Payment verified",
      message: "The server verified this payment. Do not present another tender.",
      doNotChargeAgain: true,
      contactManager: nextAction === "contact_manager",
      presentAllowed: false,
      resolveAllowed: false,
      verified: true,
    };
  }
  if (status === "requires_attention" || nextAction === "contact_manager") {
    return {
      title: "Payment needs manager review",
      message: "Escalate this payment to a manager. Do not retry or charge again.",
      warning: DO_NOT_CHARGE_AGAIN,
      doNotChargeAgain: true,
      contactManager: true,
      presentAllowed: false,
      resolveAllowed: nextAction === "resolve" || nextAction === "wait",
      verified: false,
    };
  }
  if (status === "failed") {
    return {
      title: "Payment failed",
      message: "This electronic payment failed. It is not pending. Do not treat a browser callback as success.",
      doNotChargeAgain: false,
      contactManager: false,
      presentAllowed: nextAction === "present_payment",
      resolveAllowed: nextAction === "resolve" || nextAction === "wait",
      verified: false,
    };
  }
  if (status === "cancelled") {
    return {
      title: "Payment cancelled",
      message: "This electronic payment was cancelled. It is not pending.",
      doNotChargeAgain: false,
      contactManager: false,
      presentAllowed: nextAction === "present_payment",
      resolveAllowed: nextAction === "resolve" || nextAction === "wait",
      verified: false,
    };
  }
  if (waitOrResolve || status === "pending" || status === "reconciling" || status === "initializing" || status === "awaiting_customer") {
    const title =
      status === "reconciling"
        ? "Reconciling payment"
        : status === "awaiting_customer"
          ? "Awaiting customer"
          : status === "initializing"
            ? "Initializing payment"
            : "Payment pending";
    return {
      title,
      message:
        status === "awaiting_customer"
          ? "Waiting for the customer to complete payment. Do not charge again."
          : status === "initializing"
            ? "Payment is initializing. Do not charge again."
            : status === "reconciling"
              ? "Payment status is being reconciled. Do not charge again."
              : "Payment is still pending. Do not charge again.",
      warning: DO_NOT_CHARGE_AGAIN,
      doNotChargeAgain: true,
      contactManager: false,
      presentAllowed: false,
      resolveAllowed: true,
      verified: false,
    };
  }
  return {
    title: "Electronic payment",
    message:
      nextAction === "present_payment"
        ? "The server says this payment may be presented. Present only this payment identity."
        : "Electronic payment is idle.",
    doNotChargeAgain: false,
    contactManager: false,
    presentAllowed: nextAction === "present_payment" || status === "idle",
    resolveAllowed: false,
    verified: false,
  };
}

export function electronicTenderLabel(tender: ElectronicTenderView): string {
  if (tender === "mobile_money") return "Mobile money";
  if (tender === "card") return "Card";
  return "External electronic";
}
