"use client";

import { describeRefundStatus, type RefundReconciliationView } from "./refundReconciliationView";
import { formatMoneyDisplay } from "../sell/state/quotePresentation";

export function RefundReconciliationPanel({
  session,
  inFlight,
  onResolve,
}: {
  session: RefundReconciliationView;
  inFlight: boolean;
  onResolve: () => void;
}) {
  return (
    <section
      className="refund-reconciliation"
      data-refund-id={session.refundId}
      data-refund-status={session.status}
    >
      <h3>{describeRefundStatus(session.status)}</h3>
      <p className="muted" role="status">
        Refund {session.refundId}
      </p>
      {session.amount ? <p>{formatMoneyDisplay(session.amount)}</p> : null}
      <p role={session.status === "requires_attention" || session.status === "failed" ? "alert" : "status"}>
        {session.message}
      </p>
      {session.warning ? (
        <div className="banner warning" role="alert">
          {session.warning}
        </div>
      ) : null}
      {session.resolveAllowed ? (
        <div className="dialog-actions">
          <button type="button" className="btn primary" disabled={inFlight} onClick={onResolve}>
            Check refund status
          </button>
        </div>
      ) : null}
    </section>
  );
}
