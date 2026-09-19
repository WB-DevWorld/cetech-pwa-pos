"use client";

import { describeElectronicPayment, electronicTenderLabel, type ElectronicPaymentSessionView, type ElectronicTenderView } from "./electronicPaymentView";

const TENDERS: readonly ElectronicTenderView[] = ["mobile_money", "card", "external_electronic"];

export function ElectronicPaymentPanel({
  session,
  inFlight,
  selectedTender,
  onSelectedTenderChange,
  onPresent,
  onResolve,
  onContinueWaiting,
  onContactManager,
}: {
  session: ElectronicPaymentSessionView;
  inFlight: boolean;
  selectedTender: ElectronicTenderView;
  onSelectedTenderChange: (tender: ElectronicTenderView) => void;
  onPresent: () => void;
  onResolve: () => void;
  onContinueWaiting: () => void;
  onContactManager: () => void;
}) {
  const copy = describeElectronicPayment(session.status, session.nextAction);
  const showWarning = session.doNotChargeAgain;
  const statusRole = session.status === "failed" || session.status === "requires_attention" ? "alert" : "status";

  return (
    <section
      className="electronic-payment"
      data-payment-status={session.status}
      data-payment-next-action={session.nextAction}
      data-do-not-charge-again={showWarning ? "true" : "false"}
      data-payment-verified={session.verified ? "true" : "false"}
      data-browser-callback-not-truth={session.browserCallbackIsNotTruth ? "true" : "false"}
      data-payment-id={session.paymentId ?? ""}
    >
      <h3 id="electronic-payment-title">{copy.title}</h3>
      <p className="muted" role={statusRole} aria-live="polite">
        {session.message || copy.message}
      </p>
      {showWarning ? (
        <div className="banner warning payment-do-not-charge" role="alert">
          <strong>Do not charge again.</strong>
          <span>{"We're checking this payment. Do not start another payment."}</span>
        </div>
      ) : null}
      {session.browserCallbackIsNotTruth ? (
        <div className="banner warning" role="alert">
          {"We haven't confirmed this payment yet. Do not charge again while we check its status."}
        </div>
      ) : null}
      {session.displayReference ? (
        <p className="muted" data-payment-display-reference="">
          Reference: {session.displayReference}
        </p>
      ) : null}
      {session.presentAllowed && !session.doNotChargeAgain ? (
        <div className="field">
          <label htmlFor="electronic-tender">Payment method</label>
          <select
            id="electronic-tender"
            className="select"
            value={selectedTender}
            disabled={inFlight}
            onChange={(event) => onSelectedTenderChange(event.target.value as ElectronicTenderView)}
          >
            {TENDERS.map((tender) => (
              <option key={tender} value={tender}>
                {electronicTenderLabel(tender)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="dialog-actions">
        {session.presentAllowed && !session.doNotChargeAgain ? (
          <button type="button" className="btn primary" disabled={inFlight} onClick={onPresent}>
            Start payment
          </button>
        ) : null}
        {session.resolveAllowed ? (
          <button type="button" className="btn primary" disabled={inFlight} onClick={onResolve}>
            Check payment status
          </button>
        ) : null}
        {session.doNotChargeAgain && session.resolveAllowed ? (
          <button type="button" className="btn" disabled={inFlight} onClick={onContinueWaiting}>
            Continue waiting
          </button>
        ) : null}
        {session.contactManager ? (
          <button type="button" className="btn" disabled={inFlight} onClick={onContactManager}>
            Contact manager
          </button>
        ) : null}
      </div>
    </section>
  );
}
