export const DO_NOT_CHARGE_AGAIN = "Do not charge again.";

export type PaymentStatusCopy = {
  readonly title: string;
  readonly message: string;
  readonly warning?: string;
};

export function describePaymentState(status: string, nextAction?: string): PaymentStatusCopy {
  if (status === "verified") {
    return {
      title: "Payment verified",
      message: "This payment is confirmed. Do not start another payment.",
      warning: DO_NOT_CHARGE_AGAIN,
    };
  }
  if (status === "requires_attention" || nextAction === "contact_manager") {
    return {
      title: "Payment needs manager review",
      message: "A manager needs to review this payment. Do not charge again.",
      warning: DO_NOT_CHARGE_AGAIN,
    };
  }
  if (status === "failed") {
    return {
      title: "Payment failed",
      message: "This payment did not go through. It is not pending.",
    };
  }
  if (status === "cancelled") {
    return {
      title: "Payment cancelled",
      message: "This payment was cancelled. It is not pending.",
    };
  }
  if (status === "reconciling") {
    return {
      title: "Checking payment status…",
      message: "We're checking this payment. Do not start another payment.",
      warning: DO_NOT_CHARGE_AGAIN,
    };
  }
  if (status === "awaiting_customer") {
    return {
      title: "Waiting for customer",
      message: "Waiting for the customer to finish paying. Do not charge again.",
      warning: DO_NOT_CHARGE_AGAIN,
    };
  }
  if (status === "initializing") {
    return {
      title: "Starting payment…",
      message: "Starting payment. Do not charge again.",
      warning: DO_NOT_CHARGE_AGAIN,
    };
  }
  if (status === "pending") {
    return {
      title: "Payment pending",
      message: "Payment is still being checked. Do not charge again.",
      warning: DO_NOT_CHARGE_AGAIN,
    };
  }
  if (nextAction === "present_payment") {
    return {
      title: "Electronic payment",
      message: "Choose a payment method, then start payment.",
    };
  }
  return {
    title: "Electronic payment",
    message: "Electronic payment is ready when you need it.",
  };
}

export function describePaymentUncertainty(): string {
  return "We haven't confirmed this payment yet. Do not charge again while we check its status.";
}

export function withDoNotChargeAgain(message: string): string {
  return /do not charge again/i.test(message) ? message : `${message} ${DO_NOT_CHARGE_AGAIN}`;
}
