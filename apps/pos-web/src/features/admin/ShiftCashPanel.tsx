"use client";

import type { OperationalPolicyView } from "../../server/admin/handle-operational-policy";
import type {
  ManagementShiftCashRow,
  ManagementShiftCashView,
} from "../../server/admin/management-shift-cash-directory";
import type { ShiftClosePolicy } from "../../server/auth/policy";
import { formatMoneyLabel, formatOperationalDateTime } from "../../ui/cashier-language";

const STATUS_LABEL = {
  open: "Open",
  closing: "Closing",
  requires_attention: "Needs attention",
  closed: "Closed",
} as const;

export function ShiftCashPanel({
  view,
  loading = false,
  errorMessage,
  correlationId,
  policy = null,
  policyLoading = false,
  onOpenPolicies,
  now = new Date(),
}: {
  readonly view: ManagementShiftCashView | null;
  readonly loading?: boolean;
  readonly errorMessage?: string;
  readonly correlationId?: string;
  readonly policy?: OperationalPolicyView | null;
  readonly policyLoading?: boolean;
  readonly onOpenPolicies?: () => void;
  readonly now?: Date;
}) {
  if (loading) {
    return (
      <section className="card card-pad" aria-live="polite">
        <p>Loading shifts and cash…</p>
      </section>
    );
  }
  if (errorMessage) {
    return (
      <section className="card card-pad stack" aria-live="assertive">
        <div className="banner danger" role="alert">
          Shift and cash oversight is temporarily unavailable.
        </div>
        <p>{errorMessage}</p>
        {correlationId ? <p className="muted">Reference {correlationId}</p> : null}
      </section>
    );
  }
  if (!view || view.rows.length === 0) {
    return (
      <section className="card card-pad stack">
        <h2>Shifts and cash</h2>
        <p role="status">No shifts are currently available in your management scope.</p>
        {view ? <p className="muted">{scopeCopy(view)}</p> : null}
        <PolicyContext
          policy={policy}
          policyLoading={policyLoading}
          onOpenPolicies={onOpenPolicies}
          shiftScope={view?.scope}
        />
      </section>
    );
  }

  const active = view.rows.filter((row) => row.status !== "closed");
  const closed = view.rows.filter((row) => row.status === "closed");
  const locationCount = new Set(view.rows.map((row) => row.locationId)).size;
  const registerCount = new Set(view.rows.map((row) => row.registerId)).size;

  return (
    <div className="shift-cash-panel stack">
      <p>{scopeCopy(view)}</p>
      {view.truncated ? (
        <p className="muted">
          This view is limited to {view.limit} shifts. Needs attention, closing, and open shifts come before recently closed shifts.
        </p>
      ) : null}
      <ul className="shift-cash-summary" aria-label="Operational summary">
        <SummaryStat label="Needs attention" value={count(view.rows, "requires_attention")} tone="attention" />
        <SummaryStat label="Closing" value={count(view.rows, "closing")} tone="closing" />
        <SummaryStat label="Open" value={count(view.rows, "open")} />
        <SummaryStat label="Recently closed" value={closed.length} />
      </ul>
      <p className="muted">
        {locationCount} location{locationCount === 1 ? "" : "s"} · {registerCount} register{registerCount === 1 ? "" : "s"} in this view
      </p>

      <section className="stack" aria-labelledby="shift-cash-active-heading">
        <h2 id="shift-cash-active-heading">Active and attention shifts</h2>
        {active.length === 0 ? (
          <p>No open, closing, or attention shifts in this view.</p>
        ) : (
          <div className="shift-cash-list">
            {active.map((row) => <ShiftCard key={row.shiftId} row={row} now={now} />)}
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="shift-cash-closed-heading">
        <h2 id="shift-cash-closed-heading">Recently closed</h2>
        {closed.length === 0 ? (
          <p>No recently closed shifts in this view.</p>
        ) : (
          <div className="shift-cash-list">
            {closed.map((row) => <ShiftCard key={row.shiftId} row={row} now={now} />)}
          </div>
        )}
      </section>

      <PolicyContext
        policy={policy}
        policyLoading={policyLoading}
        onOpenPolicies={onOpenPolicies}
        shiftScope={view.scope}
      />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: number;
  readonly tone?: "attention" | "closing";
}) {
  return (
    <li className={tone ? `shift-cash-stat ${tone}` : "shift-cash-stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </li>
  );
}

function ShiftCard({
  row,
  now,
}: {
  readonly row: ManagementShiftCashRow;
  readonly now: Date;
}) {
  const location = row.locationName ?? row.locationId;
  const register = row.registerName ?? row.registerId;
  const openLength = row.closedAt ? undefined : formatShiftOpenLength(row.openedAt, now);
  return (
    <article
      className="card card-pad shift-cash-card"
      data-shift-status={row.status}
      data-layout="shift-card"
    >
      <div className="shift-cash-card-main">
        <div className="stack">
          <div className="management-staff-head">
            <div>
              <h3>{location}</h3>
              <p>{register}</p>
            </div>
            <span className={statusClass(row.status)}>{STATUS_LABEL[row.status]}</span>
          </div>
          <p>Opened by {row.cashierId}</p>
          <p data-opened-at={row.openedAt}>Opened {formatOperationalDateTime(row.openedAt)}</p>
          {openLength ? <p>Open for {openLength}</p> : null}
          {row.closedAt ? <p data-closed-at={row.closedAt}>Closed {formatOperationalDateTime(row.closedAt)}</p> : null}
        </div>
        <dl className="shift-cash-money">
          <div>
            <dt>Opening float</dt>
            <dd>{formatMoneyLabel(row.openingFloat)}</dd>
          </div>
          <div>
            <dt>Expected cash</dt>
            <dd>{formatMoneyLabel(row.expectedCash)}</dd>
          </div>
          {row.countedCash ? (
            <div>
              <dt>Counted cash</dt>
              <dd>{formatMoneyLabel(row.countedCash)}</dd>
            </div>
          ) : null}
          {row.variance ? (
            <div>
              <dt>Variance</dt>
              <dd data-variance-minor={row.variance.minor}>{varianceCopy(row.variance.minor, row.variance.currency)}</dd>
            </div>
          ) : null}
        </dl>
        <div className="shift-cash-report">
          <p className="eyebrow">Report</p>
          {reportLines(row).map((line) => <p key={line}>{line}</p>)}
          {row.report.zReportId ? <p className="muted">Z reference {row.report.zReportId}</p> : null}
        </div>
      </div>
      <details>
        <summary>Reference</summary>
        <p className="muted">Shift {row.shiftId}</p>
        <p className="muted">Device {row.deviceId}</p>
      </details>
    </article>
  );
}

function PolicyContext({
  policy,
  policyLoading,
  onOpenPolicies,
  shiftScope,
}: {
  readonly policy: OperationalPolicyView | null;
  readonly policyLoading: boolean;
  readonly onOpenPolicies?: () => void;
  readonly shiftScope?: ManagementShiftCashView["scope"];
}) {
  return (
    <section className="card card-pad stack" aria-labelledby="shift-cash-policy-heading">
      <h2 id="shift-cash-policy-heading">Shift close</h2>
      {policyLoading ? <p>Loading close policy…</p> : null}
      {!policyLoading && policy ? (
        <>
          <p className="muted">{policyScopeCopy(policy)}</p>
          <ul className="shift-cash-policy">
            {policyLines(policy.effective).map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="muted">{policyScopeCaveat(policy, shiftScope)}</p>
        </>
      ) : null}
      {!policyLoading && !policy ? <p>Close policy could not be loaded. Shift oversight above is unchanged.</p> : null}
      {onOpenPolicies ? (
        <button className="btn" type="button" onClick={onOpenPolicies}>
          Open Policies
        </button>
      ) : null}
    </section>
  );
}

function policyScopeCopy(policy: OperationalPolicyView): string {
  if (policy.scope.registerId) {
    return `Policy reference: location ${policy.scope.locationId} / register ${policy.scope.registerId}.`;
  }
  if (policy.scope.locationId) {
    return `Policy reference: location ${policy.scope.locationId}.`;
  }
  return "Policy reference: organization default.";
}

function policyScopeCaveat(
  policy: OperationalPolicyView,
  shiftScope: ManagementShiftCashView["scope"] | undefined,
): string {
  if (!shiftScope) {
    return "Location or register overrides may differ from this policy reference.";
  }
  if (shiftScope.kind === "organization") {
    return "This is not necessarily the effective policy for every shift shown; location or register overrides may differ.";
  }
  if (shiftScope.locationIds.length > 1) {
    return "This policy reference covers one scope only; other visible locations or register overrides may differ.";
  }
  if (!policy.scope.registerId) {
    return "Register-specific overrides may differ from this location policy.";
  }
  return "This policy reference applies only to the named register scope.";
}

function policyLines(policy: ShiftClosePolicy): readonly string[] {
  return [
    policy.managerCanCloseShift ? "Managers allowed" : "Manager close disabled",
    policy.cashierCanCloseShift ? "Cashier close allowed" : "Cashier close disabled",
    policy.cashierCanCloseShift && policy.cashierOwnShiftOnly ? "Cashiers can close only their own shift" : "",
    policy.nonZeroVarianceRequiresManager
      ? "Non-zero variance requires manager"
      : "Non-zero variance does not require a manager",
  ].filter((line) => line.length > 0);
}

function reportLines(row: ManagementShiftCashRow): readonly string[] {
  const lines: string[] = [];
  if (row.status === "requires_attention") lines.push("Requires attention");
  if (row.report.xAvailable) lines.push("X report available");
  if (row.report.zAvailable) lines.push("Z report available");
  else if (row.status !== "closed") lines.push("Z report pending because shift is not closed");
  else lines.push("Z report is not recorded");
  return lines;
}

function varianceCopy(minor: number, currency: string): string {
  if (minor === 0) return "No variance";
  const amount = formatMoneyLabel({ minor: Math.abs(minor), currency });
  return minor > 0 ? `Over by ${amount}` : `Short by ${amount}`;
}

function statusClass(status: ManagementShiftCashRow["status"]): string {
  if (status === "requires_attention") return "status-pill danger";
  if (status === "closing") return "status-pill warning";
  if (status === "closed") return "status-pill neutral";
  return "status-pill neutral";
}

export function formatShiftOpenLength(openedAt: string, now: Date): string | undefined {
  const opened = new Date(openedAt).getTime();
  if (Number.isNaN(opened)) return undefined;
  const minutes = Math.max(0, Math.floor((now.getTime() - opened) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 48) return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
  const days = Math.floor(hours / 24);
  const leftoverHours = hours % 24;
  return leftoverHours === 0 ? `${days} days` : `${days} days ${leftoverHours} hr`;
}

function scopeCopy(view: ManagementShiftCashView): string {
  if (view.scope.kind === "organization") return "Showing shifts for the whole organization.";
  const names = [...new Set(view.rows.map((row) => row.locationName).filter((name): name is string => Boolean(name)))];
  if (names.length === 1) return `Showing shifts for ${names[0]}.`;
  if (names.length > 1) return `Showing shifts for ${names.join(", ")}.`;
  return "Showing shifts only for locations you manage.";
}

function count(rows: readonly ManagementShiftCashRow[], status: ManagementShiftCashRow["status"]): number {
  return rows.filter((row) => row.status === status).length;
}
