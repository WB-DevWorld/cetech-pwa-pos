"use client";

import { useState, type FormEvent } from "react";
import {
  checkoutDismissAllowed,
  describeCheckoutStage,
  formatMinorDecimal,
  type CheckoutSessionView,
} from "../state/checkoutSession";
import { formatMoneyDisplay } from "../state/quotePresentation";
import { ReceiptPaper } from "./ReceiptPaper";
import { SellModal } from "./SellModal";

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
}) {
  const [cashReceived, setCashReceived] = useState("");
  const copy = describeCheckoutStage(session.stage);
  const dismissable = checkoutDismissAllowed(session.stage) && !inFlight;
  const showReceipt = Boolean(session.receipt) && (session.stage === "receipt_ready" || session.stage === "printing" || session.stage === "print_failed");

  function handleCashSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight || (session.stage !== "cash" && session.stage !== "cash_failed")) {
      return;
    }
    onConfirmCash(cashReceived);
  }

  function fillExact() {
    if (!session.prepared || inFlight) {
      return;
    }
    setCashReceived(formatMinorDecimal(session.prepared.total.minor));
  }

  return (
    <SellModal titleId="checkout-dialog-title" onClose={dismissable ? onDismiss : () => undefined}>
      <div className="checkout-dialog" data-checkout-stage={session.stage} data-sale-completed={session.saleCompleted ? "true" : "false"}>
        <h2 id="checkout-dialog-title">{copy.title}</h2>
        <p className="muted" role="status" aria-live="polite">
          {session.message || copy.status}
        </p>
        {session.stage === "cash" || session.stage === "cash_failed" ? (
          <form className="stack" onSubmit={handleCashSubmit}>
            {session.prepared ? (
              <div className="big-money" data-checkout-due="prepared">
                {formatMoneyDisplay(session.prepared.total)}
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="cash-received">Cash received</label>
              <input
                id="cash-received"
                className="input"
                inputMode="decimal"
                value={cashReceived}
                disabled={inFlight}
                onChange={(event) => setCashReceived(event.target.value)}
                aria-invalid={session.inputError ? true : undefined}
                aria-describedby={session.inputError ? "cash-received-error" : "cash-received-help"}
              />
              <div className="muted" id="cash-received-help">
                Cash received is cashier input. Change due appears on the official receipt after the sale completes.
              </div>
              {session.inputError ? (
                <div id="cash-received-error" className="qty-error" role="alert">
                  {session.inputError}
                </div>
              ) : null}
            </div>
            <div className="row wrap">
              <button type="button" className="btn small" disabled={inFlight || !session.prepared} onClick={fillExact}>
                Exact
              </button>
            </div>
            <div className="dialog-actions">
              <button type="button" className="btn" disabled={inFlight} onClick={onDismiss}>
                Back
              </button>
              <button
                type="submit"
                className="btn primary"
                disabled={inFlight}
              >
                Confirm cash
              </button>
            </div>
          </form>
        ) : null}
        {session.stage === "preparing" || session.stage === "resolving_sale" || session.stage === "confirming_cash" || session.stage === "resolving_payment" || session.stage === "finalizing" || session.stage === "complete" ? (
          <div className={`payment-stage ${session.stage === "finalizing" ? "finalizing" : ""}`} data-checkout-progress={session.stage}>
            <strong>{copy.title}</strong>
          </div>
        ) : null}
        {session.stage === "prepare_failed" ? (
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onDismiss}>
              Keep cart
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
        {session.stage === "resolving_payment" ? (
          <div className="dialog-actions">
            <button type="button" className="btn primary" disabled={inFlight} onClick={onResolvePayment}>
              Check payment status
            </button>
          </div>
        ) : null}
        {session.stage === "finalize_failed" ? (
          <div className="dialog-actions">
            <button type="button" className="btn primary" disabled={inFlight} onClick={onRetryFinalize}>
              Retry finalize
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
