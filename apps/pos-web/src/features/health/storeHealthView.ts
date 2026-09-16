import type { HealthCheck, StoreHealth } from "../../../../../docs/contracts/domain.generated";

export type HealthCheckStatusView = HealthCheck["status"];

export type AttentionSeverityView =
  | "normal"
  | "informational"
  | "warning"
  | "blocking"
  | "requires_attention";

export type ConnectivityView = "online" | "offline" | "checking";

export type LeadershipView = "active" | "passive" | "unknown";

export type UpdateBlockReasonView =
  | "PASSIVE_WINDOW"
  | "ACTIVE_TENDER"
  | "CRITICAL_OPERATION_PENDING"
  | "SYNC_MUTATION_IN_PROGRESS"
  | "LOCAL_MIGRATION_IN_PROGRESS"
  | "UNSUPPORTED_APP_VERSION";

export type UpdateActivationDecisionView =
  | { readonly safe: true }
  | { readonly safe: false; readonly reasons: readonly UpdateBlockReasonView[] };

export type RecoveryActionView =
  | "RESOLVE_PENDING_OPERATIONS"
  | "REVIEW_ATTENTION_OPERATIONS"
  | "MIGRATE_LOCAL_SCHEMA"
  | "REBUILD_CATALOG_IF_NEEDED"
  | "NONE";

export type RecoveryDiagnosticsView = {
  readonly localSchema: number;
  readonly expectedSchema: number;
  readonly schemaCompatible: boolean;
  readonly cartDraftCount: number;
  readonly pendingOperationCount: number;
  readonly attentionOperationCount: number;
  readonly rebuildableCatalogItemCount: number;
  readonly destructiveResetAllowed: false;
  readonly recommendedActions: readonly RecoveryActionView[];
};

export type HealthCheckView = {
  readonly id: string;
  readonly status: HealthCheckStatusView;
  readonly message: string;
  readonly checkedAt: string;
};

export type ReleasePolicyView = {
  readonly latestBuild: string;
  readonly recommendedBuild: string;
  readonly minimumSupportedBuild: string;
  readonly criticalBuild?: string;
  readonly minimumApiVersion: string;
  readonly minimumLocalSchema: number;
};

export type StoreHealthLifecycleSnapshot = {
  readonly connectivity: ConnectivityView;
  readonly leadership: LeadershipView;
  readonly updateReady: boolean;
  readonly releasePolicy?: ReleasePolicyView;
  readonly unknownOperationPresent?: boolean;
};

export type StoreHealthSessionView = {
  readonly stage: "idle" | "loading" | "ready" | "failed";
  readonly connectivity: ConnectivityView;
  readonly leadership: LeadershipView;
  readonly updateReady: boolean;
  readonly activation: UpdateActivationDecisionView | null;
  readonly activating: boolean;
  readonly checkingUpdate: boolean;
  readonly health?: {
    readonly contractVersion: string;
    readonly pendingOperationCount: number;
    readonly attentionCount: number;
    readonly buildId: string;
    readonly checks: readonly HealthCheckView[];
  };
  readonly recovery?: RecoveryDiagnosticsView;
  readonly releasePolicy?: ReleasePolicyView;
  readonly unknownOperationPresent: boolean;
  readonly message: string;
  readonly overallSeverity: AttentionSeverityView;
};

export const DURABLE_STATE_COPY =
  "Cart drafts and the operation journal are durable business state. They must not be discarded.";

export const REBUILDABLE_STATE_COPY =
  "Catalog projection and cached application assets can be rebuilt or re-fetched. They are not the same as drafts or journal entries.";

export const UNKNOWN_OPERATION_COPY =
  "Outcome not yet confirmed. This operation needs resolution. Do not retry the sale.";

export const HEALTH_FETCH_FAILED_COPY =
  "Store health could not be loaded. This is not a healthy result.";

export const SCHEMA_INCOMPATIBLE_COPY =
  "Local schema is incompatible. Migration or recovery is required. Local business state must be preserved.";

export const PASSIVE_TAB_COPY =
  "Another POS window currently owns lifecycle leadership. This tab is passive and must not activate updates. The active POS window controls update and recovery operations.";

export const LEADERSHIP_UNKNOWN_COPY =
  "This window's lifecycle role is unknown. Do not assume another tab's identity.";

export const OFFLINE_COPY =
  "This device is offline. Drafts and the operation journal stay on this device. Catalog and cached assets may be rebuilt when a connection returns.";

export const RECONNECT_CHECKING_COPY =
  "Checking connection. Previously unknown operations still need authoritative resolution. Do not assume they succeeded or failed.";

export const NO_FORCE_UPDATE_COPY = "There is no force-update action while this block is active.";

export const DESTRUCTIVE_RESET_FORBIDDEN_COPY =
  "Destructive reset is not allowed. Do not clear IndexedDB, drafts, or the operation journal as repair.";

const PROVIDER_NAME = /paystack/gi;

export function sanitizeHealthCopy(text: string): string {
  return text.replace(PROVIDER_NAME, "payment provider");
}

export function healthCheckStatusLabel(status: HealthCheckStatusView): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "unavailable":
      return "Unavailable";
    case "unverified":
      return "Unverified — not confirmed";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function updateBlockReasonCopy(reason: UpdateBlockReasonView): string {
  switch (reason) {
    case "ACTIVE_TENDER":
      return "An active payment or tender is in progress. Finish or resolve it before updating.";
    case "CRITICAL_OPERATION_PENDING":
      return "A sale, payment, or shift operation still needs a final result. Resolve it before updating. An unknown response is not a failure.";
    case "SYNC_MUTATION_IN_PROGRESS":
      return "Synchronization or change persistence is underway. Do not interrupt it with an update.";
    case "LOCAL_MIGRATION_IN_PROGRESS":
      return "Local storage migration or recovery is in progress. Cart drafts and the operation journal must be preserved. Do not wipe storage.";
    case "PASSIVE_WINDOW":
      return PASSIVE_TAB_COPY;
    case "UNSUPPORTED_APP_VERSION":
      return "This installed build is no longer supported and needs a controlled update or recovery. Business data will not be deleted.";
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
}

export function recoveryActionCopy(action: RecoveryActionView): string {
  switch (action) {
    case "RESOLVE_PENDING_OPERATIONS":
      return "Resolve or sync pending journal operations. These are durable unresolved work, not disposable cache.";
    case "REVIEW_ATTENTION_OPERATIONS":
      return "Operations requiring attention need review. Do not blindly replay them.";
    case "MIGRATE_LOCAL_SCHEMA":
      return SCHEMA_INCOMPATIBLE_COPY;
    case "REBUILD_CATALOG_IF_NEEDED":
      return "Catalog projection is missing or empty and can be rebuilt. That is not a reason to discard drafts or journal entries.";
    case "NONE":
      return "No recovery action is recommended.";
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export function severityLabel(severity: AttentionSeverityView): string {
  switch (severity) {
    case "normal":
      return "Normal";
    case "informational":
      return "Information";
    case "warning":
      return "Warning";
    case "blocking":
      return "Blocked";
    case "requires_attention":
      return "Requires attention";
    default: {
      const exhaustive: never = severity;
      return exhaustive;
    }
  }
}

export function connectivityCopy(connectivity: ConnectivityView): string {
  switch (connectivity) {
    case "online":
      return "Online.";
    case "offline":
      return OFFLINE_COPY;
    case "checking":
      return RECONNECT_CHECKING_COPY;
    default: {
      const exhaustive: never = connectivity;
      return exhaustive;
    }
  }
}

export function mapHealthChecks(checks: StoreHealth["checks"]): readonly HealthCheckView[] {
  return checks.map((check) => ({
    id: check.id,
    status: check.status,
    message: sanitizeHealthCopy(check.message),
    checkedAt: check.checkedAt,
  }));
}

export function mapReleasePolicy(policy: ReleasePolicyView): ReleasePolicyView {
  return {
    latestBuild: policy.latestBuild,
    recommendedBuild: policy.recommendedBuild,
    minimumSupportedBuild: policy.minimumSupportedBuild,
    criticalBuild: policy.criticalBuild,
    minimumApiVersion: policy.minimumApiVersion,
    minimumLocalSchema: policy.minimumLocalSchema,
  };
}

export function mapStoreHealth(health: StoreHealth): NonNullable<StoreHealthSessionView["health"]> {
  return {
    contractVersion: health.contractVersion,
    pendingOperationCount: health.pendingOperationCount,
    attentionCount: health.attentionCount,
    buildId: health.buildId,
    checks: mapHealthChecks(health.checks),
  };
}

export function idleStoreHealthSession(): StoreHealthSessionView {
  return {
    stage: "idle",
    connectivity: "online",
    leadership: "unknown",
    updateReady: false,
    activation: null,
    activating: false,
    checkingUpdate: false,
    unknownOperationPresent: false,
    message: "Store health has not been loaded yet.",
    overallSeverity: "informational",
  };
}

export function deriveOverallSeverity(session: StoreHealthSessionView): AttentionSeverityView {
  const reasons = session.activation && !session.activation.safe ? session.activation.reasons : [];
  if (
    reasons.includes("UNSUPPORTED_APP_VERSION") ||
    reasons.includes("ACTIVE_TENDER") ||
    reasons.includes("CRITICAL_OPERATION_PENDING") ||
    reasons.includes("SYNC_MUTATION_IN_PROGRESS") ||
    reasons.includes("LOCAL_MIGRATION_IN_PROGRESS")
  ) {
    return "blocking";
  }
  if (session.recovery && !session.recovery.schemaCompatible) {
    return "blocking";
  }
  const checks = session.health?.checks ?? [];
  if (checks.some((check) => check.status === "unavailable")) {
    return "blocking";
  }
  if ((session.health?.attentionCount ?? 0) > 0 || (session.recovery?.attentionOperationCount ?? 0) > 0) {
    return "requires_attention";
  }
  if (session.unknownOperationPresent) {
    return "requires_attention";
  }
  if (session.leadership === "passive" || reasons.includes("PASSIVE_WINDOW")) {
    return session.updateReady ? "blocking" : "informational";
  }
  if (
    checks.some((check) => check.status === "degraded" || check.status === "unverified") ||
    (session.health?.pendingOperationCount ?? 0) > 0 ||
    (session.recovery?.pendingOperationCount ?? 0) > 0
  ) {
    return "warning";
  }
  if (session.stage === "failed") {
    return "warning";
  }
  if (session.stage === "ready" && checks.length > 0 && checks.every((check) => check.status === "healthy")) {
    return "normal";
  }
  return "informational";
}

export function canActivateWaitingUpdate(session: StoreHealthSessionView): boolean {
  if (!session.updateReady || session.activating || session.checkingUpdate) {
    return false;
  }
  if (session.leadership !== "active") {
    return false;
  }
  return session.activation?.safe === true;
}

export function containsForbiddenRecoveryCopy(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("clear app data") ||
    lower.includes("start over") ||
    lower.includes("wipe indexeddb") ||
    lower.includes("clear all local") ||
    lower.includes("delete local business") ||
    lower.includes("clear all caches")
  );
}
