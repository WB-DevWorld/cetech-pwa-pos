"use client";

import { useEffect, useState } from "react";
import { postStaffPaymentCommand } from "../../../app/checkout-client";
import type { PreparedSaleView } from "../state/checkoutSession";

type BeginData = {
  readonly payment: { readonly paymentId: string; readonly amount: { readonly minor: number; readonly currency: string } };
  readonly network: string;
  readonly accountLabel: string;
};

function storedKey(transactionId: string, step: string): string {
  const name = `cetech.manual-momo.${step}.${transactionId}`;
  const existing = window.sessionStorage.getItem(name);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(name, created);
  return created;
}

export function ManualMobileMoneyPanel({
  prepared,
  busy,
  onBack,
  onRecorded,
}: {
  readonly prepared: PreparedSaleView;
  readonly busy: boolean;
  readonly onBack: () => void;
  readonly onRecorded: (reference: string) => void;
}) {
  const [instructions, setInstructions] = useState<BeginData | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [reference, setReference] = useState("");
  const [checkedReceipt, setCheckedReceipt] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void postStaffPaymentCommand<BeginData>(
      "/api/pos/v1/payments/manual-mobile-money/begin",
      { transactionId: prepared.transactionId },
      storedKey(prepared.transactionId, "begin"),
    ).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setInstructions(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [prepared.transactionId]);

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
        <button type="button" className="btn" disabled={busy || saving} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={busy || saving || !instructions || !checkedReceipt || reference.trim().length < 4}
          onClick={() => {
            if (!instructions) return;
            setSaving(true);
            setError(undefined);
            void postStaffPaymentCommand<BeginData>(
              "/api/pos/v1/payments/manual-mobile-money/confirm",
              {
                transactionId: prepared.transactionId,
                paymentId: instructions.payment.paymentId,
                merchantReference: reference.trim(),
                merchantConfirmed: true,
              },
              storedKey(prepared.transactionId, "confirm"),
            ).then((result) => {
              setSaving(false);
              if (!result.ok) {
                setError(result.error.message);
                return;
              }
              onRecorded(reference.trim());
            });
          }}
        >
          Confirm payment received
        </button>
      </div>
    </div>
  );
}
