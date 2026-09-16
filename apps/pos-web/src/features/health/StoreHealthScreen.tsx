"use client";

import {
  canActivateWaitingUpdate,
  connectivityCopy,
  DURABLE_STATE_COPY,
  DESTRUCTIVE_RESET_FORBIDDEN_COPY,
  healthCheckStatusLabel,
  LEADERSHIP_UNKNOWN_COPY,
  NO_FORCE_UPDATE_COPY,
  PASSIVE_TAB_COPY,
  REBUILDABLE_STATE_COPY,
  recoveryActionCopy,
  SCHEMA_INCOMPATIBLE_COPY,
  severityLabel,
  UNKNOWN_OPERATION_COPY,
  updateBlockReasonCopy,
  type HealthCheckView,
  type RecoveryDiagnosticsView,
  type StoreHealthSessionView,
} from "./storeHealthView";

function CheckRow({ check }: { check: HealthCheckView }) {
  const label = healthCheckStatusLabel(check.status);
  return (
    <li
      className={`health-check health-check-${check.status}`}
      data-health-check-id={check.id}
      data-health-check-status={check.status}
    >
      <div className="health-check-head">
        <strong>{check.id}</strong>
        <span className="health-check-status" data-status-label={label}>
          {label}
        </span>
      </div>
      <p>{check.message}</p>
      <p className="muted">Checked {check.checkedAt}</p>
    </li>
  );
}

function UpdateStatusCard({
  session,
  inFlight,
  onCheckForUpdate,
  onActivate,
}: {
  session: StoreHealthSessionView;
  inFlight: boolean;
  onCheckForUpdate: () => void;
  onActivate: () => void;
}) {
  const canActivate = canActivateWaitingUpdate(session) && !inFlight;
  const blocked = session.activation && !session.activation.safe;
  const reasons = blocked ? session.activation.reasons : [];
  const passive = session.leadership === "passive" || reasons.includes("PASSIVE_WINDOW");
  const updateBlocked = Boolean(blocked) || passive || session.leadership !== "active";

  return (
    <section className="card card-pad store-health-card" data-update-ready={session.updateReady ? "true" : "false"} data-update-safe={session.activation?.safe === true ? "true" : "false"}>
      <h2>Application update</h2>
      {session.updateReady ? (
        <div className="banner warning" role={updateBlocked ? "alert" : "status"} data-update-waiting="">
          A waiting update is ready. The lifecycle controller decides whether it is safe to activate.
        </div>
      ) : (
        <p className="muted" role="status">
          No waiting update is reported.
        </p>
      )}
      {session.releasePolicy ? (
        <dl className="health-meta">
          <div>
            <dt>Latest build</dt>
            <dd>{session.releasePolicy.latestBuild}</dd>
          </div>
          <div>
            <dt>Recommended</dt>
            <dd>{session.releasePolicy.recommendedBuild}</dd>
          </div>
          <div>
            <dt>Minimum supported</dt>
            <dd>{session.releasePolicy.minimumSupportedBuild}</dd>
          </div>
          {session.health ? (
            <div>
              <dt>Installed build</dt>
              <dd>{session.health.buildId}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {reasons.map((reason) => (
        <div
          key={reason}
          className="banner danger"
          role="alert"
          data-update-block-reason={reason}
        >
          <div>
            <strong>{reason.replace(/_/g, " ")}</strong>
            <p>{updateBlockReasonCopy(reason)}</p>
            <p>{NO_FORCE_UPDATE_COPY}</p>
          </div>
        </div>
      ))}
      {passive ? (
        <div className="banner warning" role="alert" data-passive-tab="">
          {PASSIVE_TAB_COPY}
        </div>
      ) : null}
      {session.leadership === "unknown" ? (
        <p className="muted" data-leadership-unknown="">
          {LEADERSHIP_UNKNOWN_COPY}
        </p>
      ) : null}
      <div className="store-health-actions">
        {canActivate ? (
          <button type="button" className="btn primary" disabled={inFlight} onClick={onActivate} data-activate-update="">
            {session.activating ? "Activating update…" : "Activate waiting update"}
          </button>
        ) : (
          <p className="muted" data-update-disabled-reason="">
            {updateBlocked
              ? "Update activation is unavailable until the lifecycle controller reports it is safe and this window is the active POS tab."
              : "No safe waiting update is available to activate."}
          </p>
        )}
        <button
          type="button"
          className="btn"
          disabled={inFlight || session.leadership === "passive"}
          onClick={onCheckForUpdate}
        >
          {session.checkingUpdate ? "Checking for update…" : "Check for update"}
        </button>
      </div>
    </section>
  );
}

function RecoveryStatusCard({ recovery }: { recovery: RecoveryDiagnosticsView }) {
  return (
    <section className="card card-pad store-health-card" data-recovery="" data-schema-compatible={recovery.schemaCompatible ? "true" : "false"} data-destructive-reset-allowed="false">
      <h2>Recovery diagnostics</h2>
      {!recovery.schemaCompatible ? (
        <div className="banner danger" role="alert" data-schema-incompatible="">
          {SCHEMA_INCOMPATIBLE_COPY} Local schema {recovery.localSchema}, expected {recovery.expectedSchema}.
        </div>
      ) : (
        <p className="muted" role="status">
          Local schema {recovery.localSchema} matches expected {recovery.expectedSchema}.
        </p>
      )}
      <dl className="health-meta">
        <div data-cart-draft-count={String(recovery.cartDraftCount)}>
          <dt>Cart drafts</dt>
          <dd>
            {recovery.cartDraftCount} preserved. {DURABLE_STATE_COPY}
          </dd>
        </div>
        <div data-pending-journal-count={String(recovery.pendingOperationCount)}>
          <dt>Pending journal operations</dt>
          <dd>{recovery.pendingOperationCount} durable unresolved operations that must be resolved or synced.</dd>
        </div>
        <div data-attention-journal-count={String(recovery.attentionOperationCount)}>
          <dt>Attention operations</dt>
          <dd>
            {recovery.attentionOperationCount} need review rather than blind replay. These are not ordinary pending
            operations.
          </dd>
        </div>
        <div data-rebuildable-catalog-count={String(recovery.rebuildableCatalogItemCount)}>
          <dt>Rebuildable catalog</dt>
          <dd>
            {recovery.rebuildableCatalogItemCount} catalog projection items. {REBUILDABLE_STATE_COPY}
          </dd>
        </div>
      </dl>
      <ul className="health-actions-list">
        {recovery.recommendedActions.map((action) => (
          <li key={action} data-recovery-action={action}>
            {recoveryActionCopy(action)}
          </li>
        ))}
      </ul>
      <p className="muted" data-no-destructive-reset="">
        {DESTRUCTIVE_RESET_FORBIDDEN_COPY}
      </p>
    </section>
  );
}

export function StoreHealthScreen({
  session,
  inFlight,
  onRefresh,
  onCheckForUpdate,
  onActivateWaitingUpdate,
}: {
  session: StoreHealthSessionView;
  inFlight: boolean;
  onRefresh: () => void;
  onCheckForUpdate: () => void;
  onActivateWaitingUpdate: () => void;
}) {
  const loading = session.stage === "loading" || inFlight;
  const failed = session.stage === "failed";
  const checks = session.health?.checks ?? [];

  return (
    <div
      className="store-health-screen"
      data-store-health-stage={session.stage}
      data-connectivity={session.connectivity}
      data-leadership={session.leadership}
      data-severity={session.overallSeverity}
      data-phone-layout=""
    >
      <div className="page-head">
        <div>
          <h1>Store Health</h1>
          <p>Availability, recovery, and update safety come from server health and the lifecycle controller.</p>
        </div>
        <p className="health-severity" data-severity-label={severityLabel(session.overallSeverity)}>
          {severityLabel(session.overallSeverity)}
        </p>
      </div>
      <div className="store-health-stack">
        {session.connectivity !== "online" ? (
          <div
            className={session.connectivity === "offline" ? "banner warning" : "banner info"}
            role={session.connectivity === "offline" ? "alert" : "status"}
            data-offline-banner={session.connectivity}
          >
            {connectivityCopy(session.connectivity)} {DURABLE_STATE_COPY} {REBUILDABLE_STATE_COPY}
          </div>
        ) : null}
        {loading ? (
          <div className="banner info" role="status" data-health-loading="">
            Checking store health.
          </div>
        ) : null}
        {failed ? (
          <div className="banner danger" role="alert" data-health-fetch-failed="">
            {session.message}
          </div>
        ) : null}
        {session.unknownOperationPresent ? (
          <div className="banner warning" role="alert" data-unknown-operation="">
            {UNKNOWN_OPERATION_COPY}
          </div>
        ) : null}
        {session.health ? (
          <section className="card card-pad store-health-card" data-store-health-summary="">
            <h2>Summary</h2>
            <p className="muted" role="status">
              {session.message}
            </p>
            <dl className="health-meta">
              <div data-contract-version={session.health.contractVersion}>
                <dt>Contract</dt>
                <dd>{session.health.contractVersion}</dd>
              </div>
              <div data-build-id={session.health.buildId}>
                <dt>Build</dt>
                <dd>{session.health.buildId}</dd>
              </div>
              <div data-pending-count={String(session.health.pendingOperationCount)}>
                <dt>Pending operations</dt>
                <dd>{session.health.pendingOperationCount}</dd>
              </div>
              <div data-attention-count={String(session.health.attentionCount)}>
                <dt>Attention count</dt>
                <dd>{session.health.attentionCount}</dd>
              </div>
            </dl>
            {session.health.attentionCount > 0 ? (
              <div className="banner warning" role="alert" data-attention-ux="">
                {session.health.attentionCount} operations require attention. Review them instead of assuming success
                or failure.
              </div>
            ) : null}
            {session.health.pendingOperationCount > 0 ? (
              <div className="banner warning" role="status" data-pending-ux="">
                {session.health.pendingOperationCount} pending operations are still unresolved.
              </div>
            ) : null}
          </section>
        ) : null}
        {checks.length > 0 ? (
          <section className="card card-pad store-health-card">
            <h2>Health checks</h2>
            <ul className="health-check-list">
              {checks.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          </section>
        ) : null}
        <UpdateStatusCard
          session={session}
          inFlight={inFlight}
          onCheckForUpdate={onCheckForUpdate}
          onActivate={onActivateWaitingUpdate}
        />
        {session.recovery ? <RecoveryStatusCard recovery={session.recovery} /> : null}
        <div className="store-health-actions">
          <button type="button" className="btn" disabled={inFlight} onClick={onRefresh}>
            Refresh health
          </button>
        </div>
      </div>
    </div>
  );
}
