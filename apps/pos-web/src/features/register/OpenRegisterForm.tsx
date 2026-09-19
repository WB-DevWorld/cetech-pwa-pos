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
  const registerId = selectedRegisterId !== undefined ? selectedRegisterId : uncontrolledRegister;
  const canSubmit = online && !submitting && Boolean(registerId) && Boolean(onSubmit);
  const needsExplicitChoice = registerId === "" && registers.length > 1;

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
          <p>Select a register and open a shift before taking payment.</p>
        </div>
      </div>
      <section className="card card-pad register-open" aria-labelledby="open-register-title">
        <h2 id="open-register-title" className="sr-only">
          Open register
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
              {needsExplicitChoice ? <option value="">Select a register</option> : null}
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
              Recorded as the opening float for the shift.
            </div>
          </div>
          {(localError || errorMessage) ? (
            <div className="banner danger" role="alert">
              {localError || errorMessage}
            </div>
          ) : null}
          <button className="btn primary" type="submit" disabled={!canSubmit}>
            {submitting ? "Opening…" : "Open register"}
          </button>
          {!online ? (
            <div className="banner warning" role="status">
              Connection required to open a register.
            </div>
          ) : null}
        </form>
      </section>
    </div>
  );
}
