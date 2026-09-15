"use client";

import { formatMoneyDisplay } from "../sell/state/quotePresentation";
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

function EffectRow({ label, effect }: { label: string; effect?: ReturnSessionView["providerRefund"] }) {
  if (!effect) {
    return null;
  }
  return (
    <div className="r-row" data-effect-name={label} data-effect-status={effect.status} data-effect-id={effect.effectId ?? ""}>
      <span>{label}</span>
      <span>
        {effect.status}
        {effect.effectId ? ` · ${effect.effectId}` : ""}
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
                <strong>{line.name}</strong>
                <div className="muted">Sold {line.originalSoldQuantity}</div>
              </div>
            </div>
            <div className="grid-3">
              <div className="field">
                <label htmlFor={`return-qty-${line.orderLineId}`}>Return qty</label>
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
              <p className="muted">Stock disposition follows the server preview. Refund is not restock.</p>
            )}
            {preview ? (
              <div
                className="return-preview-line"
                data-remaining-qty={preview.remainingReturnableQuantity}
                data-automatic-sellable={preview.automaticSellableRestock ? "true" : "false"}
                data-intended-disposition={preview.intendedDisposition}
                data-disposition-policy={preview.dispositionPolicy}
              >
                <div>Remaining returnable: {preview.remainingReturnableQuantity}</div>
                <div>Server disposition: {dispositionLabel(preview.intendedDisposition)}</div>
                <div>Server policy: {dispositionPolicyLabel(preview.dispositionPolicy)}</div>
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
          Manager approval is required. Do not invent an approval.
        </div>
      ) : null}
      {session.approvalId ? (
        <p className="muted" data-bound-approval={session.approvalId}>
          Approval bound: {session.approvalId}
        </p>
      ) : null}
      {session.providerRefund || session.cashRefund || session.commercialRefund || session.stockDisposition ? (
        <div className="card card-pad" data-return-effects="">
          <strong>Independent effects</strong>
          <EffectRow label="Provider refund" effect={session.providerRefund} />
          <EffectRow label="Cash refund" effect={session.cashRefund} />
          <EffectRow label="Commercial refund" effect={session.commercialRefund} />
          <EffectRow label="Stock disposition" effect={session.stockDisposition} />
        </div>
      ) : null}
      {session.refundIdentities.length > 0 ? (
        <ul data-refund-identities="">
          {session.refundIdentities.map((id) => (
            <li key={id} data-refund-identity={id}>
              Refund {id}
            </li>
          ))}
        </ul>
      ) : null}
      {!complete && unresolved.length > 0 ? (
        <div className="banner warning" role="alert" data-return-unresolved="">
          Unresolved: {unresolved.join(", ")}. This return is not complete.
        </div>
      ) : null}
      {complete ? (
        <div className="banner success" role="status" data-return-complete-banner="">
          Return complete.
        </div>
      ) : null}
      <div className="dialog-actions">
        {!locked && (session.stage === "selecting" || session.stage === "failed" || session.stage === "previewed" || session.stage === "approval_required") ? (
          <button type="button" className="btn" disabled={inFlight} onClick={onPreview}>
            Preview return
          </button>
        ) : null}
        {!locked && (session.stage === "previewed" || (session.stage === "approval_required" && session.approvalId)) && session.returnId ? (
          <button type="button" className="btn primary" disabled={inFlight} onClick={onExecute}>
            Execute return
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
