"use client";

import { formatMoneyDisplay } from "../sell/state/quotePresentation";
import { orderStatusLabel } from "../../ui/cashier-language";
import {
  canPresentReturnComplete,
  conditionLabel,
  conditionRestockNotice,
  describeReturnStage,
  dispositionLabel,
  dispositionPolicyLabel,
  OUTSTANDING_RETURN_COPY,
  unresolvedEffectLabels,
  type ReturnConditionView,
  type ReturnSessionView,
} from "./returnView";

const CONDITIONS: readonly ReturnConditionView[] = [
  "resellable",
  "opened_resellable",
  "damaged",
  "defective",
  "quarantine",
  "not_physically_returned",
];

function friendlyPending(label: string): string {
  switch (label) {
    case "payment refund":
      return "Payment refund pending";
    case "cash refund":
      return "Cash refund pending";
    case "order refund":
      return "Order refund needs review";
    case "stock update":
      return "Stock update needs attention";
    default:
      return label;
  }
}

function EffectRow({
  label,
  effect,
  refundIdentity = false,
}: {
  label: string;
  effect?: ReturnSessionView["providerRefund"];
  refundIdentity?: boolean;
}) {
  if (!effect) {
    return null;
  }
  const tone =
    effect.status === "completed"
      ? "success"
      : effect.status === "not_required"
        ? "info"
        : effect.status === "requires_attention"
          ? "danger"
          : "warning";
  return (
    <div
      className="r-row return-effect-row"
      data-effect-name={label}
      data-effect-status={effect.status}
      data-effect-id={effect.effectId ?? ""}
      data-refund-identity={refundIdentity ? effect.effectId ?? "" : undefined}
    >
      <span className="return-effect-label">{label}</span>
      <span className={`workspace-badge ${tone} return-effect-status`}>
        {orderStatusLabel(effect.status)}
      </span>
    </div>
  );
}

export function ReturnFlow({
  session,
  inFlight,
  onUpdateLine,
  onPreview,
  onExecute,
  onResolve,
}: {
  session: ReturnSessionView;
  inFlight: boolean;
  onUpdateLine: (orderLineId: string, patch: { quantity?: string; reason?: string; condition?: ReturnConditionView }) => void;
  onPreview: () => void;
  onExecute: () => void;
  onResolve: () => void;
}) {
  const copy = describeReturnStage(session.stage);
  const complete = canPresentReturnComplete(session);
  const unresolved = unresolvedEffectLabels(session);
  const locked = session.identityLocked;
  const fieldsDisabled = inFlight || locked;

  return (
    <section
      className="return-flow"
      data-return-stage={session.stage}
      data-return-id={session.returnId ?? ""}
      data-return-complete={complete ? "true" : "false"}
      data-return-identity-locked={locked ? "true" : "false"}
      data-approval-required={session.approvalRequired ? "true" : "false"}
      data-approval-id={session.approvalId ?? ""}
    >
      <h2 id="return-flow-title">{copy.title}</h2>
      <p className="muted" role="status" aria-live="polite">
        {session.message || copy.status}
      </p>
      {locked ? (
        <div className="banner warning" role="alert" data-outstanding-return="">
          {OUTSTANDING_RETURN_COPY}
        </div>
      ) : null}
      {session.inputError ? (
        <div className="banner danger" role="alert">
          {session.inputError}
        </div>
      ) : null}
      {session.lines.map((line) => {
        const preview = session.previewLines.find((item) => item.orderLineId === line.orderLineId);
        const safety = conditionRestockNotice(line.condition);
        return (
          <article key={line.orderLineId} className="card card-pad return-line" data-order-line-id={line.orderLineId}>
            <div className="row between">
              <div>
                <strong className="compact-product-name">{line.name}</strong>
                <div className="muted">Sold {line.originalSoldQuantity}</div>
              </div>
            </div>
            <div className="grid-3">
              <div className="field">
                <label htmlFor={`return-qty-${line.orderLineId}`}>Quantity to return</label>
                <input
                  id={`return-qty-${line.orderLineId}`}
                  className="input"
                  value={line.quantity}
                  disabled={fieldsDisabled}
                  onChange={(event) => onUpdateLine(line.orderLineId, { quantity: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`return-reason-${line.orderLineId}`}>Reason</label>
                <input
                  id={`return-reason-${line.orderLineId}`}
                  className="input"
                  value={line.reason}
                  disabled={fieldsDisabled}
                  onChange={(event) => onUpdateLine(line.orderLineId, { reason: event.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor={`return-condition-${line.orderLineId}`}>Condition</label>
                <select
                  id={`return-condition-${line.orderLineId}`}
                  className="select"
                  value={line.condition}
                  disabled={fieldsDisabled}
                  onChange={(event) =>
                    onUpdateLine(line.orderLineId, { condition: event.target.value as ReturnConditionView })
                  }
                >
                  {CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {conditionLabel(condition)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {safety ? (
              <div className="banner warning" role="status" data-restock-safety={line.condition}>
                {safety}
              </div>
            ) : (
              <p className="muted">The refund and the stock action are confirmed separately.</p>
            )}
            {preview ? (
              <div
                className="return-preview-line"
                data-remaining-qty={preview.remainingReturnableQuantity}
                data-automatic-sellable={preview.automaticSellableRestock ? "true" : "false"}
                data-intended-disposition={preview.intendedDisposition}
                data-disposition-policy={preview.dispositionPolicy}
              >
                <div>Remaining returnable quantity: {preview.remainingReturnableQuantity}</div>
                <div>Stock action: {dispositionLabel(preview.intendedDisposition)}</div>
                <div>Stock rule: {dispositionPolicyLabel(preview.dispositionPolicy)}</div>
                {preview.intendedDisposition === "no_automatic_restock" ? (
                  <div className="banner info" role="status">
                    No automatic restock.
                  </div>
                ) : null}
                {!preview.automaticSellableRestock ? (
                  <div data-not-automatic-sellable="">Not automatically restocked as sellable.</div>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
      {session.refundTotal ? (
        <div className="big-money" data-refund-total={String(session.refundTotal.minor)}>
          Refund total {formatMoneyDisplay(session.refundTotal)}
        </div>
      ) : null}
      {session.approvalRequired && !session.approvalId ? (
        <div className="banner warning" role="alert" data-approval-missing="">
          Manager approval is required before you can continue.
        </div>
      ) : null}
      {session.approvalId ? (
        <div className="banner success" role="status" data-bound-approval="">
          Manager approval recorded.
        </div>
      ) : null}
      {session.providerRefund || session.cashRefund || session.commercialRefund || session.stockDisposition ? (
        <div className="card card-pad return-effect-card" data-return-effects="">
          <strong>Return progress</strong>
          <div className="return-effect-list">
          <EffectRow label="Payment refund" effect={session.providerRefund} refundIdentity />
          <EffectRow label="Cash refund" effect={session.cashRefund} refundIdentity />
          <EffectRow label="Order refund" effect={session.commercialRefund} />
          <EffectRow label="Stock update" effect={session.stockDisposition} />
          </div>
          {session.cashRefund?.status === "completed" && !complete ? (
            <div className="banner info return-effect-safety" role="status" data-cash-refund-complete-warning="">
              <strong>Cash refund already completed.</strong>
              <span>Do not refund the customer again while the order refund or stock update is being checked.</span>
            </div>
          ) : null}
          {session.commercialRefund?.status === "requires_attention" ? (
            <div className="banner warning return-effect-safety" role="alert" data-order-refund-review="">
              <strong>Order refund needs review.</strong>
              <span>Do not create another Woo order refund. A manager or support person must check the existing refund first.</span>
            </div>
          ) : null}
          {(session.stockDisposition?.status === "pending" ||
            session.stockDisposition?.status === "in_progress" ||
            session.stockDisposition?.status === "requires_attention") ? (
            <div className="banner warning return-effect-safety" role="status" data-stock-update-review="">
              <strong>Stock update is not settled yet.</strong>
              <span>Do not adjust stock manually until this return has been checked.</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {!complete && unresolved.length > 0 ? (
        <div className="banner warning" role="alert" data-return-unresolved="">
          {"This return isn't finished yet. Some refund or stock updates are still pending."}
          <ul>
            {unresolved.map((label) => <li key={label}>{friendlyPending(label)}</li>)}
          </ul>
        </div>
      ) : null}
      {complete ? (
        <div className="banner success" role="status" data-return-complete-banner="">
          Return completed successfully.
        </div>
      ) : null}
      <div className="dialog-actions">
        {!locked && (session.stage === "selecting" || session.stage === "failed" || session.stage === "previewed" || session.stage === "approval_required") ? (
          <button type="button" className="btn" disabled={inFlight} onClick={onPreview}>
            Review return
          </button>
        ) : null}
        {!locked && (session.stage === "previewed" || session.stage === "approval_required") && session.returnId ? (
          <button type="button" className="btn primary" disabled={inFlight} onClick={onExecute}>
            {session.stage === "approval_required" && !session.approvalId ? "Check approval" : "Complete return"}
          </button>
        ) : null}
        {locked || session.stage === "resolving" || session.stage === "in_progress" || session.stage === "refund_pending" || session.stage === "requires_attention" ? (
          <button type="button" className="btn primary" disabled={inFlight} onClick={onResolve}>
            Check return status
          </button>
        ) : null}
      </div>
    </section>
  );
}
