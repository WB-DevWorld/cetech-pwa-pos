"use client";

import { describeElectronicPayment, type ElectronicPaymentSessionView } from "../../payments/electronicPaymentView";

function waitingCopy(session: ElectronicPaymentSessionView): { title: string; message: string; warning?: string } {
  if (session.status === "initializing") {
    return { title: "Starting payment…", message: "Starting payment…" };
  }
  if (session.status === "awaiting_customer") {
    return { title: "Waiting for payment", message: "Waiting for customer…" };
  }
  if (session.status === "pending") {
    return {
      title: "Payment is still being checked.",
      message: "Payment is still being checked.",
      warning: "Do not charge again.",
    };
  }
  if (session.status === "reconciling") {
    return {
      title: "Checking payment status…",
      message: "Checking payment status…",
      warning: "Do not charge again.",
    };
  }
  if (session.status === "verified") {
    return { title: "Payment confirmed", message: "This payment is confirmed." };
  }
  if (session.status === "failed") {
    return { title: "Payment failed.", message: session.message || "This payment did not go through." };
  }
  if (session.status === "cancelled") {
    return { title: "Payment cancelled.", message: session.message || "This payment was cancelled." };
  }
  if (session.status === "requires_attention") {
    return {
      title: "This payment needs review.",
      message: "Do not charge again. Contact a manager.",
      warning: "Do not charge again.",
    };
  }
  const copy = describeElectronicPayment(session.status, session.nextAction);
  return { title: copy.title, message: session.message || copy.message, warning: copy.warning };
}

export function PaymentWaiting({
  session,
  inFlight,
  onResolve,
  onReturnToChoices,
  onContactManager,
}: {
  session: ElectronicPaymentSessionView;
  inFlight: boolean;
  onResolve: () => void;
  onReturnToChoices?: () => void;
  onContactManager?: () => void;
}) {
  const copy = waitingCopy(session);
  const canReturn =
    Boolean(onReturnToChoices) &&
    (session.status === "failed" || session.status === "cancelled") &&
    session.presentAllowed &&
    !session.doNotChargeAgain;
  const statusRole = session.status === "failed" || session.status === "requires_attention" ? "alert" : "status";
  const showChargeBanner =
    session.status === "pending" ||
    session.status === "reconciling" ||
    session.status === "requires_attention" ||
    Boolean(copy.warning && session.status !== "awaiting_customer" && session.status !== "initializing");

  return (
    <div
      className="payment-waiting"
      data-payment-status={session.status}
      data-do-not-charge-again={session.doNotChargeAgain ? "true" : "false"}
      data-payment-verified={session.verified ? "true" : "false"}
      data-browser-callback-not-truth={session.browserCallbackIsNotTruth ? "true" : "false"}
    >
      {(session.status === "initializing" ||
        session.status === "awaiting_customer" ||
        session.status === "pending" ||
        session.status === "reconciling") && <div className="payment-spinner" aria-hidden="true" />}
      <p className="muted" role={statusRole} aria-live="polite">
        {copy.message}
      </p>
      {showChargeBanner ? (
        <div className="banner warning payment-do-not-charge" role="alert">
          <strong>Do not charge again.</strong>
        </div>
      ) : null}
      {session.displayReference ? (
        <p className="muted" data-payment-display-reference="">
          Reference: {session.displayReference}
        </p>
      ) : null}
      <div className="dialog-actions">
        {session.resolveAllowed ? (
          <button type="button" className="btn primary" disabled={inFlight} onClick={onResolve}>
            Check payment status
          </button>
        ) : null}
        {canReturn ? (
          <button type="button" className="btn" disabled={inFlight} onClick={onReturnToChoices}>
            Choose another method
          </button>
        ) : null}
        {session.contactManager ? (
          <button type="button" className="btn" disabled={inFlight} onClick={() => onContactManager?.()}>
            Contact a manager
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function electronicSessionLocksCheckout(session: ElectronicPaymentSessionView | undefined): boolean {
  if (!session) return false;
  return (
    session.doNotChargeAgain ||
    session.status === "initializing" ||
    session.status === "awaiting_customer" ||
    session.status === "pending" ||
    session.status === "reconciling" ||
    session.status === "verified" ||
    session.status === "requires_attention"
  );
}

export function electronicSessionShowsWaiting(session: ElectronicPaymentSessionView | undefined): boolean {
  if (!session) return false;
  return session.status !== "idle";
}
