"use client";

import { CloseShiftForm } from "./CloseShiftForm";
import { OpenRegisterForm, type OpenRegisterFormProps } from "./OpenRegisterForm";
import { formatMoneyDisplay } from "../sell/state/quotePresentation";
import { describeShiftStatus, formatSignedMoneyDisplay, type ShiftWorkspaceView } from "./shiftView";

export function RegisterScreen({
  openForm,
  session,
  inFlight,
  onOpen,
  onClose,
  onShowXReport,
  onBindApproval,
}: {
  openForm: OpenRegisterFormProps;
  session: ShiftWorkspaceView;
  inFlight: boolean;
  onOpen?: (openingFloatMinor: number) => void;
  onClose?: (countedCashText: string) => void;
  onShowXReport?: () => void;
  onBindApproval?: () => void;
}) {
  const copy = describeShiftStatus(session.status);
  const showOpen = session.status === "no_open_shift" || session.status === "opening";
  const showClose = session.status === "open" || session.status === "closing";
  const showClosed = session.status === "closed";
  const showAttention = session.status === "requires_attention";

  return (
    <div className="register-screen" data-shift-status={session.status} data-close-succeeded={session.closeSucceeded ? "true" : "false"}>
      {showOpen ? (
        <OpenRegisterForm
          {...openForm}
          submitting={inFlight || session.status === "opening" || openForm.submitting}
          errorMessage={session.inputError ?? session.message !== copy.status ? session.inputError ?? openForm.errorMessage : openForm.errorMessage}
          onSubmit={
            onOpen
              ? (input) => {
                  onOpen(input.openingFloatMinor);
                }
              : openForm.onSubmit
          }
        />
      ) : null}
      {!showOpen ? (
        <div className="page-head">
          <div>
            <h1>{copy.title}</h1>
            <p role="status">{session.message || copy.status}</p>
          </div>
        </div>
      ) : null}
      {session.status === "open" ? (
        <section className="card card-pad">
          <p className="muted">Shift {session.shiftId}</p>
          {onShowXReport ? (
            <button type="button" className="btn" disabled={inFlight} onClick={onShowXReport}>
              Show X report
            </button>
          ) : null}
        </section>
      ) : null}
      {showClose ? (
        <CloseShiftForm
          submitting={inFlight || session.status === "closing"}
          errorMessage={session.inputError}
          onSubmit={onClose}
        />
      ) : null}
      {showAttention ? (
        <div className="banner warning" role="alert" data-shift-attention="">
          This shift needs manager review. It is not closed.
          {onBindApproval ? (
            <button type="button" className="btn" disabled={inFlight} onClick={onBindApproval}>
              Request manager approval
            </button>
          ) : (
            <span> Manager approval stays server-owned.</span>
          )}
        </div>
      ) : null}
      {showClosed ? (
        <section className="card card-pad" data-shift-closed="">
          <div className="banner success" role="status">
            Shift closed.
          </div>
          {session.countedCash ? (
            <div data-closed-counted="">
              Counted {formatMoneyDisplay(session.countedCash)}
            </div>
          ) : null}
          {session.expectedCash ? (
            <div data-closed-expected="" data-expected-cash-editable="false">
              Expected {formatMoneyDisplay(session.expectedCash)}
            </div>
          ) : null}
          {session.variance ? (
            <div data-closed-variance="">Variance {formatSignedMoneyDisplay(session.variance)}</div>
          ) : null}
        </section>
      ) : null}
      {session.report && session.status === "closed" && session.report.kind === "Z" ? (
        <section className="card card-pad" data-z-report="">
          <strong>Z report</strong>
          <div>Expected {formatMoneyDisplay(session.report.expectedCash)}</div>
          {session.report.countedCash ? <div>Counted {formatMoneyDisplay(session.report.countedCash)}</div> : null}
          {session.report.variance ? <div>Variance {formatSignedMoneyDisplay(session.report.variance)}</div> : null}
        </section>
      ) : null}
    </div>
  );
}
