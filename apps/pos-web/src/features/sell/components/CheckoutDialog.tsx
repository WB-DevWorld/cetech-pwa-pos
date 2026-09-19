"use client";

import { useState } from "react";
import type { ElectronicPaymentSessionView, ElectronicTenderView } from "../../payments/electronicPaymentView";
import {
  checkoutCloseRequestsCancel,
  checkoutDismissAllowed,
  describeCheckoutStage,
  type CheckoutSessionView,
} from "../state/checkoutSession";
import { CashPaymentForm } from "./CashPaymentForm";
import { PaymentWaiting, electronicSessionLocksCheckout, electronicSessionShowsWaiting } from "./PaymentWaiting";
import { ReceiptPaper } from "./ReceiptPaper";
import { SellModal } from "./SellModal";
import {
  DEFAULT_TENDER_AVAILABILITY,
  TenderChoice,
  type TenderAvailabilityView,
  type TenderChoiceId,
} from "./TenderChoice";

export function CheckoutDialog({
  session,
  inFlight,
  onConfirmCash,
  onResolveSale,
  onResolvePayment,
  onRetryFinalize,
  onRetryReceipt,
  onPrint,
  onNewSale,
  onDismiss,
  onSelectCash,
  onBackToPaymentChoice,
  onCancelPreparedSale,
  onSelectElectronic,
  tenderAvailability = DEFAULT_TENDER_AVAILABILITY,
  electronicSession,
  electronicInFlight = false,
  onResolveElectronic,
  onContactManager,
  initialCashReceived,
}: {
  session: CheckoutSessionView;
  inFlight: boolean;
  onConfirmCash: (cashReceivedText: string) => void;
  onResolveSale: () => void;
  onResolvePayment: () => void;
  onRetryFinalize: () => void;
  onRetryReceipt: () => void;
  onPrint: () => void;
  onNewSale: () => void;
  onDismiss: () => void;
  onSelectCash?: () => void;
  onBackToPaymentChoice?: () => void;
  onCancelPreparedSale?: () => void;
  onSelectElectronic?: (tender: ElectronicTenderView) => void;
  tenderAvailability?: TenderAvailabilityView;
  electronicSession?: ElectronicPaymentSessionView;
  electronicInFlight?: boolean;
  onResolveElectronic?: () => void;
  onContactManager?: () => void;
  initialCashReceived?: string;
}) {
  const [cashReceived, setCashReceived] = useState(initialCashReceived ?? "");
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const copy = describeCheckoutStage(session.stage);
  const dismissable = checkoutDismissAllowed(session) && !inFlight;
  const electronicLocked = electronicSessionLocksCheckout(electronicSession);
  const showElectronicWaiting = electronicSessionShowsWaiting(electronicSession);
  const showReceipt = Boolean(session.receipt) && (session.stage === "receipt_ready" || session.stage === "printing" || session.stage === "print_failed");
  const showCashForm =
    (session.stage === "cash" || session.stage === "cash_failed") && !electronicLocked && !showElectronicWaiting;
  const showChoose =
    session.stage === "choose_payment" && session.prepared && !showElectronicWaiting && !confirmingCancel;
  const closeRequestsCancel = checkoutCloseRequestsCancel(session.stage) && Boolean(onCancelPreparedSale);
  const closeDisabled =
    inFlight ||
    electronicInFlight ||
    electronicLocked ||
    session.stage === "confirming_cash" ||
    session.stage === "cancelling" ||
    session.stage === "resolving_payment" ||
    session.stage === "finalizing";
  const busy = inFlight || electronicInFlight;
  const heading =
    showElectronicWaiting && electronicSession
      ? electronicSession.status === "awaiting_customer"
        ? "Waiting for payment"
        : describeCheckoutStage(session.stage).title === "Choose payment"
          ? waitingTitle(electronicSession.status)
          : copy.title
      : confirmingCancel
        ? "Cancel prepared sale?"
        : copy.title;

  function requestClose() {
    if (closeDisabled) {
      if (session.stage === "resolving_payment" || electronicLocked) {
        onResolveElectronic?.();
        onResolvePayment();
      }
      return;
    }
    if (dismissable) {
      onDismiss();
      return;
    }
    if (closeRequestsCancel) {
      setConfirmingCancel(true);
    }
  }

  function handleTender(id: TenderChoiceId) {
    if (id === "cash") {
      onSelectCash?.();
      setCashReceived("");
      return;
    }
    onSelectElectronic?.(id);
  }

  return (
    <SellModal
      titleId="checkout-dialog-title"
      onClose={requestClose}
      showClose
      closeLabel={closeRequestsCancel ? "Cancel prepared sale" : "Close"}
      closeDisabled={closeDisabled && !dismissable}
      size="payment"
      focusKey={`${session.stage}:${heading}:${electronicSession?.status ?? ""}:${confirmingCancel ? "cancel" : ""}`}
    >
      <div
        className="checkout-dialog"
        data-checkout-stage={session.stage}
        data-sale-completed={session.saleCompleted ? "true" : "false"}
        data-checkout-dismissable={dismissable ? "true" : "false"}
        data-prepared-outstanding={session.prepared ? "true" : "false"}
        data-confirming-cancel={confirmingCancel ? "true" : "false"}
      >
        <h2 id="checkout-dialog-title" tabIndex={-1}>
          {heading}
        </h2>
        {session.stage === "preparing" || session.stage === "cancelling" ? (
          session.message && session.message !== copy.title ? (
            <p className="muted" role="status" aria-live="polite">
              {session.message}
            </p>
          ) : (
            <p className="sr-only" role="status" aria-live="polite">
              {copy.status}
            </p>
          )
        ) : session.stage !== "choose_payment" && !showCashForm && !showElectronicWaiting ? (
          <p className="muted" role="status" aria-live="polite">
            {session.message || copy.status}
          </p>
        ) : null}
        {confirmingCancel ? (
          <div className="stack">
            <p>This releases the held stock. Cart items stay on this sale.</p>
            <div className="dialog-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => setConfirmingCancel(false)}>
                Keep sale
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => {
                  setConfirmingCancel(false);
                  onCancelPreparedSale?.();
                }}
              >
                Cancel prepared sale
              </button>
            </div>
          </div>
        ) : null}
        {showChoose && session.prepared ? (
          <TenderChoice
            prepared={session.prepared}
            availability={tenderAvailability}
            disabled={busy}
            onSelect={handleTender}
            onCancelPrepared={() => setConfirmingCancel(true)}
          />
        ) : null}
        {showCashForm && session.prepared ? (
          <CashPaymentForm
            prepared={session.prepared}
            cashReceived={cashReceived}
            onCashReceivedChange={setCashReceived}
            inputError={session.inputError}
            busy={busy}
            onBack={() => {
              setCashReceived("");
              onBackToPaymentChoice?.();
            }}
            onConfirm={onConfirmCash}
          />
        ) : null}
        {showElectronicWaiting && electronicSession ? (
          <PaymentWaiting
            session={electronicSession}
            inFlight={busy}
            onResolve={() => onResolveElectronic?.()}
            onReturnToChoices={onBackToPaymentChoice}
            onContactManager={onContactManager}
          />
        ) : null}
        {session.stage === "resolving_sale" ||
        session.stage === "confirming_cash" ||
        session.stage === "resolving_payment" ||
        session.stage === "finalizing" ||
        session.stage === "complete" ? (
          <div className={`payment-stage ${session.stage === "finalizing" ? "finalizing" : ""}`} data-checkout-progress={session.stage}>
            <strong>{copy.title}</strong>
          </div>
        ) : null}
        {session.stage === "prepare_failed" && dismissable ? (
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onDismiss}>
              Keep cart
            </button>
          </div>
        ) : null}
        {session.stage === "cancel_failed" ? (
          <div className="dialog-actions">
            <button type="button" className="btn primary" disabled={inFlight} onClick={() => onCancelPreparedSale?.()}>
              Try cancelling again
            </button>
            <button type="button" className="btn" disabled={inFlight} onClick={onResolveSale}>
              Check sale status
            </button>
          </div>
        ) : null}
        {session.stage === "resolving_sale" ? (
          <div className="dialog-actions">
            <button type="button" className="btn primary" disabled={inFlight} onClick={onResolveSale}>
              Check sale status
            </button>
          </div>
        ) : null}
        {session.stage === "resolving_payment" && !showElectronicWaiting ? (
          <div className="dialog-actions">
            <button type="button" className="btn primary" disabled={inFlight} onClick={onResolvePayment}>
              Check payment status
            </button>
          </div>
        ) : null}
        {session.stage === "finalize_failed" ? (
          <div className="dialog-actions">
            <button type="button" className="btn primary" disabled={inFlight} onClick={onRetryFinalize}>
              Try finishing sale again
            </button>
          </div>
        ) : null}
        {session.stage === "receipt_failed" ? (
          <div className="dialog-actions">
            <button type="button" className="btn primary" disabled={inFlight} onClick={onRetryReceipt}>
              Retry receipt
            </button>
            <button type="button" className="btn" onClick={onNewSale}>
              New sale
            </button>
          </div>
        ) : null}
        {showReceipt && session.receipt ? (
          <>
            <div className="banner success">
              <strong>Sale complete.</strong>
              <span>The official receipt was loaded from the receipt service.</span>
            </div>
            <ReceiptPaper receipt={session.receipt} />
            {session.printStatus === "dialog_opened" ? (
              <p className="muted" role="status">
                {session.printMessage ?? "Print dialog opened."}
              </p>
            ) : null}
            {session.stage === "print_failed" || session.printStatus === "failed" || session.printStatus === "unsupported" ? (
              <div className="banner warning" role="alert">
                {session.printMessage ?? "Printing failed. The sale remains complete."}
              </div>
            ) : null}
            <div className="dialog-actions">
              <button type="button" className="btn" disabled={inFlight} onClick={onPrint}>
                {session.printStatus === "idle" ? "Print receipt" : "Retry print"}
              </button>
              <button type="button" className="btn primary" disabled={inFlight && session.stage === "printing"} onClick={onNewSale}>
                New sale
              </button>
            </div>
          </>
        ) : null}
      </div>
    </SellModal>
  );
}

function waitingTitle(status: ElectronicPaymentSessionView["status"]): string {
  if (status === "initializing") return "Starting payment…";
  if (status === "awaiting_customer") return "Waiting for payment";
  if (status === "pending") return "Payment is still being checked.";
  if (status === "reconciling") return "Checking payment status…";
  if (status === "verified") return "Payment confirmed";
  if (status === "requires_attention") return "This payment needs review.";
  return "Waiting for payment";
}
