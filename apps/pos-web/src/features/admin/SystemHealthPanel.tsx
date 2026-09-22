"use client";

import type { ManagementSystemHealthView } from "../../server/admin/management-system-health";
import { formatOperationalDateTime } from "../../ui/cashier-language";

const STATUS_LABEL = {
  unavailable: "Unavailable",
  degraded: "Needs attention",
  unverified: "Not confirmed",
  healthy: "Working",
} as const;

const OVERALL_COPY = {
  unavailable: "A required service check is unavailable.",
  degraded: "Some service checks need attention.",
  unverified: "Some service checks are not confirmed.",
  healthy: "The service checks that ran succeeded.",
} as const;

export function SystemHealthPanel({
  view,
  loading = false,
  errorMessage,
  correlationId,
}: {
  readonly view: ManagementSystemHealthView | null;
  readonly loading?: boolean;
  readonly errorMessage?: string;
  readonly correlationId?: string;
}) {
  if (loading) {
    return (
      <section className="card card-pad" aria-live="polite">
        <p>Loading system health…</p>
      </section>
    );
  }
  if (errorMessage || !view) {
    return (
      <section className="card card-pad stack" aria-live="assertive">
        <div className="banner danger" role="alert">System health is temporarily unavailable.</div>
        {errorMessage ? <p>{errorMessage}</p> : null}
        {correlationId ? <p className="muted">Reference {correlationId}</p> : null}
      </section>
    );
  }

  return (
    <div className="system-health-panel stack" data-layout="system-health">
      <section className={`banner ${view.overall === "healthy" ? "success" : view.overall === "unverified" ? "warning" : "danger"}`} role="status">
        <strong>{STATUS_LABEL[view.overall]}</strong>
        <p>{OVERALL_COPY[view.overall]}</p>
      </section>
      {view.checks.length === 0 ? (
        <p role="status">No service checks were returned.</p>
      ) : (
        <div className="system-health-list">
          {view.checks.map((check) => (
            <article
              key={check.id}
              className="card card-pad system-health-card"
              data-health-status={check.status}
            >
              <div className="system-health-head">
                <div>
                  <h2>{check.label}</h2>
                  <p>{check.summary}</p>
                </div>
                <span className={statusClass(check.status)}>{STATUS_LABEL[check.status]}</span>
              </div>
              <p className="muted">Checked {formatOperationalDateTime(check.checkedAt)}</p>
              {check.detail ? (
                <details>
                  <summary>Technical detail</summary>
                  <p className="muted">{check.detail}</p>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      )}
      <details>
        <summary>Reference</summary>
        <p className="muted">Build {view.buildId}</p>
      </details>
    </div>
  );
}

function statusClass(status: ManagementSystemHealthView["overall"]): string {
  if (status === "unavailable" || status === "degraded") return "status-pill danger";
  if (status === "healthy") return "status-pill success";
  return "status-pill neutral";
}
