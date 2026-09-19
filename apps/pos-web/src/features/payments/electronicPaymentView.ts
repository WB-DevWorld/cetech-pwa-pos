import { describePaymentState, DO_NOT_CHARGE_AGAIN } from "../../ui/cashier-language";

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

export { DO_NOT_CHARGE_AGAIN } from "../../ui/cashier-language";

export function idleElectronicPaymentSession(): ElectronicPaymentSessionView {
  return {
    status: "idle",
    nextAction: "present_payment",
    message: "Choose a payment method, then start payment.",
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
  const copy = describePaymentState(status, nextAction);
  const waitOrResolve = paymentInstructsWaitOrResolve(status, nextAction);
  if (status === "verified") {
    return {
      title: copy.title,
      message: copy.message,
      warning: copy.warning,
      doNotChargeAgain: true,
      contactManager: nextAction === "contact_manager",
      presentAllowed: false,
      resolveAllowed: false,
      verified: true,
    };
  }
  if (status === "requires_attention" || nextAction === "contact_manager") {
    return {
      title: copy.title,
      message: copy.message,
      warning: copy.warning,
      doNotChargeAgain: true,
      contactManager: true,
      presentAllowed: false,
      resolveAllowed: nextAction === "resolve" || nextAction === "wait",
      verified: false,
    };
  }
  if (status === "failed" || status === "cancelled") {
    return {
      title: copy.title,
      message: copy.message,
      doNotChargeAgain: false,
      contactManager: false,
      presentAllowed: nextAction === "present_payment",
      resolveAllowed: nextAction === "resolve" || nextAction === "wait",
      verified: false,
    };
  }
  if (waitOrResolve || status === "pending" || status === "reconciling" || status === "initializing" || status === "awaiting_customer") {
    return {
      title: copy.title,
      message: copy.message,
      warning: copy.warning ?? DO_NOT_CHARGE_AGAIN,
      doNotChargeAgain: true,
      contactManager: false,
      presentAllowed: false,
      resolveAllowed: true,
      verified: false,
    };
  }
  return {
    title: copy.title,
    message: copy.message,
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
