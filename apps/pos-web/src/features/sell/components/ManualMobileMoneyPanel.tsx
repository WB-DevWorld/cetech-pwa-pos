"use client";

import { useEffect, useRef, useState } from "react";
import type { CommandContext } from "../../../../../../docs/contracts/domain.generated";
import type { ManualMobileMoneyClient } from "../../../app/checkout-client";
import type { PreparedSaleView } from "../state/checkoutSession";

type BeginData = {
  readonly payment: { readonly paymentId: string; readonly status: string; readonly displayReference?: string };
  readonly network: string;
  readonly accountLabel: string;
};

export function ManualMobileMoneyPanel({
  prepared,
  busy,
  client,
  beginContext,
  confirmContext,
  onBack,
  onRecorded,
  onActivity,
  onRetained,
  onReplaceConfirmKey,
}: {
  readonly prepared: PreparedSaleView;
  readonly busy: boolean;
  readonly client?: ManualMobileMoneyClient;
  readonly beginContext?: CommandContext;
  readonly confirmContext?: CommandContext;
  readonly onBack: () => void;
  readonly onRecorded: (reference: string) => void;
  readonly onActivity?: (active: boolean) => void;
  readonly onRetained?: (paymentId: string) => void;
  readonly onReplaceConfirmKey?: () => CommandContext | undefined;
}) {
  const [instructions, setInstructions] = useState<BeginData | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [reference, setReference] = useState("");
  const [checkedReceipt, setCheckedReceipt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [replacementKey, setReplacementKey] = useState<CommandContext | undefined>();
  const confirmKey = replacementKey ?? confirmContext;
  const onActivityRef = useRef(onActivity);
  const onRecordedRef = useRef(onRecorded);
  const onRetainedRef = useRef(onRetained);
  useEffect(() => {
    onActivityRef.current = onActivity;
    onRecordedRef.current = onRecorded;
    onRetainedRef.current = onRetained;
  });

  useEffect(() => {
    if (!client || !beginContext) {
      return;
    }
    let cancelled = false;
    onActivityRef.current?.(true);
    void client.begin(prepared.transactionId, beginContext).then((result) => {
      if (cancelled) return;
      onActivityRef.current?.(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.data.payment.status === "verified") {
        onRecordedRef.current(result.data.payment.displayReference || result.data.network);
        return;
      }
      onRetainedRef.current?.(result.data.payment.paymentId);
      setInstructions(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [beginContext, client, prepared.transactionId]);

  if (!client || !beginContext) {
    return (
      <div className="stack" data-manual-mobile-money="true">
        <p role="alert">Manual confirmation cannot start because this register cannot keep a local recovery record.</p>
        <button type="button" className="btn" onClick={onBack}>Back</button>
      </div>
    );
  }

  return (
    <div className="stack" data-manual-mobile-money="true">
      <p>
        Ask the customer to transfer this sale total. Check the merchant receipt yourself. A customer screenshot is not
        confirmation.
      </p>
      {instructions ? (
        <div>
          <p>
            <strong>{instructions.network}</strong>
            <span> · {instructions.accountLabel}</span>
          </p>
          <p className="muted">The amount is the prepared sale total. The browser cannot change it.</p>
        </div>
      ) : (
        <p role="status">Preparing the payment record…</p>
      )}
      <label>
        Merchant receipt reference
        <input value={reference} onChange={(event) => setReference(event.target.value)} autoComplete="off" />
      </label>
      <label>
        <input type="checkbox" checked={checkedReceipt} onChange={(event) => setCheckedReceipt(event.target.checked)} />
        I checked the merchant receipt for this sale.
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <div className="dialog-actions">
        <button type="button" className="btn" disabled={busy || saving || Boolean(instructions)} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy || saving || !instructions}
          onClick={() => {
            if (!instructions || !confirmKey) return;
            setSaving(true);
            setError(undefined);
            onActivity?.(true);
            void client.begin(prepared.transactionId, beginContext).then((result) => {
              setSaving(false);
              onActivity?.(false);
              if (!result.ok) {
                setError(result.error.message);
                return;
              }
              if (result.data.payment.status === "verified") {
                onRecorded(result.data.payment.displayReference || reference.trim());
                return;
              }
              setInstructions(result.data);
            });
          }}
        >
          Check payment status
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy || saving || !instructions || !checkedReceipt || reference.trim().length < 4 || !confirmKey}
          onClick={() => {
            if (!instructions || !confirmKey) return;
            setSaving(true);
            setError(undefined);
            onActivity?.(true);
            void client.confirm(
              {
                transactionId: prepared.transactionId,
                paymentId: instructions.payment.paymentId,
                merchantReference: reference.trim(),
                merchantConfirmed: true,
              },
              confirmKey,
            ).then((result) => {
              setSaving(false);
              onActivity?.(false);
              if (!result.ok) {
                if (result.error.code === "VALIDATION_ERROR") {
                  const next = onReplaceConfirmKey?.();
                  if (next) setReplacementKey(next);
                }
                setError(result.error.message);
                return;
              }
              const storedReference = result.data.payment.displayReference || reference.trim();
              onRecorded(storedReference);
            });
          }}
        >
          Confirm payment received
        </button>
      </div>
    </div>
  );
}
