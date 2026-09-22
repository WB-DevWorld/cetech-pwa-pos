"use client";

import { useState } from "react";
import type { ShiftClosePolicyOverride } from "../../server/auth/policy";
import type { OperationalPolicyView } from "../../server/admin/handle-operational-policy";
import { parseDecimalToMinorUnits } from "../register/parseDecimalToMinorUnits";

export function PolicyPanel({
  view,
  loading,
  saving,
  errorMessage,
  onSave,
}: {
  readonly view: OperationalPolicyView | null;
  readonly loading?: boolean;
  readonly saving?: boolean;
  readonly errorMessage?: string;
  readonly onSave?: (override: ShiftClosePolicyOverride) => void;
}) {
  if (loading) {
    return <section className="card card-pad"><p>Loading operational policy…</p></section>;
  }
  if (errorMessage) {
    return <section className="card card-pad"><div className="banner danger">{errorMessage}</div></section>;
  }
  if (!view) {
    return <section className="card card-pad"><p>Operational policy is not available.</p></section>;
  }

  const editorKey = [
    view.scope.organizationId,
    view.scope.locationId ?? "",
    view.scope.registerId ?? "",
    view.effective.cashierCanCloseShift,
    view.effective.managerCanCloseShift,
    view.effective.cashierOwnShiftOnly,
    view.effective.managerCanCloseOthersShift,
    view.effective.nonZeroVarianceRequiresManager,
    view.effective.varianceToleranceMinor ?? "",
    view.effective.varianceCurrency ?? "",
  ].join(":");

  return (
    <PolicyEditor
      key={editorKey}
      view={view}
      saving={saving}
      onSave={onSave}
    />
  );
}

function PolicyEditor({
  view,
  saving,
  onSave,
}: {
  readonly view: OperationalPolicyView;
  readonly saving?: boolean;
  readonly onSave?: (override: ShiftClosePolicyOverride) => void;
}) {
  const [draft, setDraft] = useState<ShiftClosePolicyOverride>(() => ({
    cashierCanCloseShift: view.effective.cashierCanCloseShift,
    managerCanCloseShift: view.effective.managerCanCloseShift,
    cashierOwnShiftOnly: view.effective.cashierOwnShiftOnly,
    managerCanCloseOthersShift: view.effective.managerCanCloseOthersShift,
    nonZeroVarianceRequiresManager: view.effective.nonZeroVarianceRequiresManager,
    ...(view.effective.varianceToleranceMinor !== undefined
      ? { varianceToleranceMinor: view.effective.varianceToleranceMinor }
      : {}),
    ...(view.effective.varianceCurrency
      ? { varianceCurrency: view.effective.varianceCurrency }
      : {}),
  }));
  const [toleranceText, setToleranceText] = useState(
    ((view.effective.varianceToleranceMinor ?? 0) / 100).toFixed(2),
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const currency = view.effective.varianceCurrency ?? "GHS";

  function setBoolean(key: keyof ShiftClosePolicyOverride, value: boolean) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    const parsed = parseDecimalToMinorUnits(toleranceText, {
      emptyMessage: "Enter a variance tolerance.",
    });
    if (!parsed.ok) {
      setLocalError(parsed.message);
      return;
    }
    setLocalError(null);
    onSave?.({
      cashierCanCloseShift: draft.cashierCanCloseShift ?? view.effective.cashierCanCloseShift,
      managerCanCloseShift: draft.managerCanCloseShift ?? view.effective.managerCanCloseShift,
      cashierOwnShiftOnly: draft.cashierOwnShiftOnly ?? view.effective.cashierOwnShiftOnly,
      managerCanCloseOthersShift:
        draft.managerCanCloseOthersShift ?? view.effective.managerCanCloseOthersShift,
      nonZeroVarianceRequiresManager:
        draft.nonZeroVarianceRequiresManager ??
        view.effective.nonZeroVarianceRequiresManager,
      varianceToleranceMinor: parsed.minor,
      varianceCurrency: currency,
    });
  }

  return (
    <section className="card card-pad stack management-policy">
      <div className="management-policy-head">
        <div>
          <h2>Shift close authority</h2>
          <p className="muted">
            Scope: {view.scope.registerId
              ? `${view.scope.locationId} / ${view.scope.registerId}`
              : view.scope.locationId ?? "Organization default"}
          </p>
        </div>
        <span className="status-pill">{view.canManage ? "Editable" : "Read only"}</span>
      </div>

      <label className="management-policy-row">
        <span>
          <strong>Cashier may close shift</strong>
          <small>Allows a cashier to submit shift close when other rules permit it.</small>
        </span>
        <input
          type="checkbox"
          checked={draft.cashierCanCloseShift ?? view.effective.cashierCanCloseShift}
          disabled={!view.canManage || saving}
          onChange={(event) => setBoolean("cashierCanCloseShift", event.target.checked)}
        />
      </label>

      <label className="management-policy-row">
        <span>
          <strong>Manager may close shift</strong>
          <small>Allows operational managers to close shifts in their assigned scope.</small>
        </span>
        <input
          type="checkbox"
          checked={draft.managerCanCloseShift ?? view.effective.managerCanCloseShift}
          disabled={!view.canManage || saving}
          onChange={(event) => setBoolean("managerCanCloseShift", event.target.checked)}
        />
      </label>

      <label className="management-policy-row">
        <span>
          <strong>Cashier own shift only</strong>
          <small>Prevents a cashier from closing a shift opened by another staff member.</small>
        </span>
        <input
          type="checkbox"
          checked={draft.cashierOwnShiftOnly ?? view.effective.cashierOwnShiftOnly}
          disabled={!view.canManage || saving}
          onChange={(event) => setBoolean("cashierOwnShiftOnly", event.target.checked)}
        />
      </label>

      <label className="management-policy-row">
        <span>
          <strong>Manager may close another staff member&apos;s shift</strong>
          <small>Applies only inside the manager&apos;s authorized location/register scope.</small>
        </span>
        <input
          type="checkbox"
          checked={
            draft.managerCanCloseOthersShift ??
            view.effective.managerCanCloseOthersShift
          }
          disabled={!view.canManage || saving}
          onChange={(event) =>
            setBoolean("managerCanCloseOthersShift", event.target.checked)
          }
        />
      </label>

      <label className="management-policy-row">
        <span>
          <strong>Non-zero variance requires manager</strong>
          <small>Cashier close escalates when the drawer variance exceeds the tolerance.</small>
        </span>
        <input
          type="checkbox"
          checked={
            draft.nonZeroVarianceRequiresManager ??
            view.effective.nonZeroVarianceRequiresManager
          }
          disabled={!view.canManage || saving}
          onChange={(event) =>
            setBoolean("nonZeroVarianceRequiresManager", event.target.checked)
          }
        />
      </label>

      <label className="field">
        <span>Variance tolerance ({currency})</span>
        <input
          className="input"
          inputMode="decimal"
          value={toleranceText}
          disabled={!view.canManage || saving}
          onChange={(event) => {
            setToleranceText(event.target.value);
            setLocalError(null);
          }}
        />
      </label>

      {localError ? <div className="banner danger">{localError}</div> : null}

      {view.canManage && onSave ? (
        <button className="btn primary" type="button" disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save shift policy"}
        </button>
      ) : (
        <div className="banner warning" role="status">
          You can review the effective policy for this scope, but organization owner/admin authority is required to change it.
        </div>
      )}
    </section>
  );
}
