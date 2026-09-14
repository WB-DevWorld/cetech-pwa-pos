/**
 * FE-05 checkout presentation view-model.
 * Discriminants describe cashier-visible stages; they are not CheckoutUseCases.
 */

export type CheckoutMoneyView = {
  readonly minor: number;
  readonly currency: string;
};

export type PreparedSaleView = {
  readonly transactionId: string;
  readonly saleId: string;
  readonly orderReference: string;
  readonly quoteFingerprint: string;
  readonly total: CheckoutMoneyView;
};

export type ReceiptLineView = {
  readonly name: string;
  readonly variationLabel?: string;
  readonly quantity: string;
  readonly unitPrice: CheckoutMoneyView;
  readonly total: CheckoutMoneyView;
};

export type ReceiptViewModel = {
  readonly id: string;
  readonly transactionId: string;
  readonly receiptNumber: string;
  readonly orderReference: string;
  readonly issuedAt: string;
  readonly locationName: string;
  readonly registerName: string;
  readonly cashierName: string;
  readonly customerLabel: string;
  readonly lines: readonly ReceiptLineView[];
  readonly subtotal: CheckoutMoneyView;
  readonly discount: CheckoutMoneyView;
  readonly tax: CheckoutMoneyView;
  readonly total: CheckoutMoneyView;
  readonly tender: string;
  readonly cashReceived?: CheckoutMoneyView;
  readonly changeDue?: CheckoutMoneyView;
  readonly documentKind: "operational_pos_receipt";
};

export type PrintStatusView = "idle" | "printing" | "dialog_opened" | "failed" | "unsupported";

export type CheckoutStageView =
  | "idle"
  | "preparing"
  | "prepare_failed"
  | "resolving_sale"
  | "cash"
  | "confirming_cash"
  | "cash_failed"
  | "resolving_payment"
  | "finalizing"
  | "finalize_failed"
  | "complete"
  | "receipt_failed"
  | "receipt_ready"
  | "printing"
  | "print_failed";

export type CheckoutSessionView = {
  readonly stage: CheckoutStageView;
  readonly message: string;
  readonly inputError?: string;
  readonly prepared?: PreparedSaleView;
  readonly receipt?: ReceiptViewModel;
  readonly printStatus: PrintStatusView;
  readonly printMessage?: string;
  readonly saleCompleted: boolean;
  readonly transactionId?: string;
};

export function idleCheckoutSession(): CheckoutSessionView {
  return {
    stage: "idle",
    message: "",
    printStatus: "idle",
    saleCompleted: false,
  };
}

export function checkoutCommandInFlight(stage: CheckoutStageView): boolean {
  return (
    stage === "preparing" ||
    stage === "resolving_sale" ||
    stage === "confirming_cash" ||
    stage === "resolving_payment" ||
    stage === "finalizing" ||
    stage === "printing"
  );
}

export function checkoutDialogOpen(stage: CheckoutStageView): boolean {
  return stage !== "idle";
}

export function hasOutstandingPreparedSale(session: CheckoutSessionView): boolean {
  if (session.saleCompleted) {
    return false;
  }
  if (session.prepared) {
    return true;
  }
  return (
    session.stage === "cash" ||
    session.stage === "cash_failed" ||
    session.stage === "confirming_cash" ||
    session.stage === "resolving_payment" ||
    session.stage === "finalizing" ||
    session.stage === "finalize_failed"
  );
}

export function canBeginNewSale(session: CheckoutSessionView): boolean {
  if (hasOutstandingPreparedSale(session)) {
    return false;
  }
  if (checkoutCommandInFlight(session.stage)) {
    return false;
  }
  if (session.stage === "resolving_sale" || session.stage === "resolving_payment") {
    return false;
  }
  if (session.saleCompleted) {
    return (
      session.stage === "complete" ||
      session.stage === "receipt_ready" ||
      session.stage === "receipt_failed" ||
      session.stage === "printing" ||
      session.stage === "print_failed"
    );
  }
  return session.stage === "idle" || session.stage === "prepare_failed";
}

/** Only an unprepared failure may return to the editable Sell workspace. */
export function checkoutDismissAllowed(session: CheckoutSessionView): boolean {
  return session.stage === "prepare_failed" && !hasOutstandingPreparedSale(session);
}

export function formatMinorDecimal(minor: number): string {
  if (!Number.isInteger(minor) || minor < 0) {
    return "";
  }
  const whole = Math.trunc(minor / 100);
  const frac = minor - whole * 100;
  const fracText = frac < 10 ? `0${frac}` : String(frac);
  return `${whole}.${fracText}`;
}

export function describeCheckoutStage(stage: CheckoutStageView): {
  readonly title: string;
  readonly status: string;
} {
  switch (stage) {
    case "idle":
      return { title: "Checkout", status: "" };
    case "preparing":
      return { title: "Preparing sale", status: "Preparing order. Rechecking price and stock before money is accepted." };
    case "prepare_failed":
      return { title: "Prepare failed", status: "The sale was not prepared. The cart is unchanged." };
    case "resolving_sale":
      return {
        title: "Checking sale",
        status: "Sale status is uncertain. Do not start another sale. Checking the existing transaction.",
      };
    case "cash":
      return { title: "Cash payment", status: "Enter cash received. The server verifies the tender." };
    case "confirming_cash":
      return { title: "Confirming cash", status: "Confirming cash payment. Do not send another tender." };
    case "cash_failed":
      return { title: "Cash confirmation failed", status: "Cash was not confirmed. The cart is unchanged." };
    case "resolving_payment":
      return {
        title: "Checking payment",
        status: "Payment status is uncertain. Do not confirm cash again. Checking the existing tender.",
      };
    case "finalizing":
      return { title: "Finalizing sale", status: "Finalizing the sale. Payment has been submitted; do not charge again." };
    case "finalize_failed":
      return { title: "Finalization failed", status: "The sale could not be finalized. Do not start another payment." };
    case "complete":
      return { title: "Sale complete", status: "The sale is complete. Loading the official receipt." };
    case "receipt_failed":
      return {
        title: "Receipt unavailable",
        status: "The sale is complete, but the receipt could not be loaded. Do not repeat the sale.",
      };
    case "receipt_ready":
      return { title: "Sale complete", status: "The sale is complete." };
    case "printing":
      return { title: "Printing receipt", status: "Sending the receipt to the printer." };
    case "print_failed":
      return { title: "Print failed", status: "Printing failed. The sale remains complete." };
  }
}
