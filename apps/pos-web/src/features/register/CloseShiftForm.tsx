"use client";

import { useState, type FormEvent } from "react";
import { parseDecimalToMinorUnits } from "./parseDecimalToMinorUnits";

export function CloseShiftForm({
  currencyLabel = "Cash counted",
  submitting = false,
  errorMessage,
  onSubmit,
}: {
  currencyLabel?: string;
  submitting?: boolean;
  errorMessage?: string;
  onSubmit?: (countedCashText: string) => void;
}) {
  const [counted, setCounted] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const canSubmit = Boolean(onSubmit) && !submitting;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const parsed = parseDecimalToMinorUnits(counted, { emptyMessage: "Enter the counted cash." });
    if (!parsed.ok) {
      setLocalError(parsed.message);
      return;
    }
    setLocalError(null);
    onSubmit?.(counted);
  }

  return (
    <section className="card card-pad register-close" aria-labelledby="close-register-title" data-blind-close="true">
      <h2 id="close-register-title">Close register</h2>
      <div className="banner info" role="status">
        <strong>Blind cash count</strong>
        <span>Count the drawer. Do not enter or edit expected cash.</span>
      </div>
      <form className="stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="closing-count">{currencyLabel}</label>
          <input
            className="input"
            id="closing-count"
            name="countedCash"
            inputMode="decimal"
            value={counted}
            disabled={submitting}
            onChange={(event) => {
              setLocalError(null);
              setCounted(event.target.value);
            }}
            aria-describedby="closing-count-help"
          />
          <div className="muted" id="closing-count-help">
            Enter only the cash you counted. Expected cash and variance come from the server after close.
          </div>
        </div>
        {(localError || errorMessage) ? (
          <div className="banner danger" role="alert">
            {localError || errorMessage}
          </div>
        ) : null}
        <button className="btn primary" type="submit" disabled={!canSubmit}>
          {submitting ? "Closing…" : "Close shift"}
        </button>
      </form>
    </section>
  );
}
