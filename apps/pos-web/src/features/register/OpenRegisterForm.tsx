"use client";

import { useState, type FormEvent } from "react";
import { parseDecimalToMinorUnits } from "./parseDecimalToMinorUnits";

export type RegisterChoice = {
  readonly id: string;
  readonly name: string;
  readonly locationLabel?: string;
};

export type OpenRegisterSubmit = {
  readonly registerId: string;
  readonly openingFloatMinor: number;
};

export type OpenRegisterFormProps = {
  registers: readonly RegisterChoice[];
  selectedRegisterId?: string;
  onRegisterChange?: (registerId: string) => void;
  openingFloat?: string;
  onOpeningFloatChange?: (value: string) => void;
  currencyLabel?: string;
  online?: boolean;
  submitting?: boolean;
  errorMessage?: string;
  onSubmit?: (input: OpenRegisterSubmit) => void;
};

export function OpenRegisterForm({
  registers,
  selectedRegisterId,
  onRegisterChange,
  openingFloat,
  onOpeningFloatChange,
  currencyLabel = "Opening cash",
  online = true,
  submitting = false,
  errorMessage,
  onSubmit,
}: OpenRegisterFormProps) {
  const [uncontrolledFloat, setUncontrolledFloat] = useState("500.00");
  const [uncontrolledRegister, setUncontrolledRegister] = useState(registers[0]?.id ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  const floatValue = openingFloat ?? uncontrolledFloat;
  const registerId = selectedRegisterId ?? uncontrolledRegister;
  const canSubmit = online && !submitting && Boolean(registerId) && Boolean(onSubmit);

  function handleFloatChange(value: string) {
    setLocalError(null);
    if (onOpeningFloatChange) onOpeningFloatChange(value);
    else setUncontrolledFloat(value);
  }

  function handleRegisterChange(value: string) {
    if (onRegisterChange) onRegisterChange(value);
    else setUncontrolledRegister(value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    const parsed = parseDecimalToMinorUnits(floatValue);
    if (!parsed.ok) {
      setLocalError(parsed.message);
      return;
    }
    onSubmit?.({ registerId, openingFloatMinor: parsed.minor });
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Register</h1>
          <p>Select a register and start a shift before taking payment.</p>
        </div>
      </div>
      <section className="card card-pad register-open" aria-labelledby="open-register-title">
        <h2 id="open-register-title" className="sr-only">
          Start shift
        </h2>
        <form className="stack" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="register-select">Register</label>
            <select
              className="select"
              id="register-select"
              value={registerId}
              onChange={(event) => handleRegisterChange(event.target.value)}
              disabled={submitting || registers.length === 0}
            >
              {registers.length === 0 ? <option value="">No registers available</option> : null}
              {registers.map((register) => (
                <option key={register.id} value={register.id}>
                  {register.locationLabel ? `${register.name} · ${register.locationLabel}` : register.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="opening-float">{currencyLabel}</label>
            <input
              className="input"
              id="opening-float"
              inputMode="decimal"
              value={floatValue}
              onChange={(event) => handleFloatChange(event.target.value)}
              aria-describedby="opening-help"
              disabled={submitting}
            />
            <div className="muted" id="opening-help">
              Enter the cash currently in the drawer. This becomes the opening balance for your shift.
            </div>
          </div>
          {(localError || errorMessage) ? (
            <div className="banner danger" role="alert">
              {localError || errorMessage}
            </div>
          ) : null}
          <button className="btn primary" type="submit" disabled={!canSubmit}>
            {submitting ? "Starting…" : "Start shift"}
          </button>
          {!online ? (
            <div className="banner warning" role="status">
              Connection required to start a shift.
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}
