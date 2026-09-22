export {
  POS_LOCAL_DB_NAME,
  POS_LOCAL_SCHEMA_CURRENT,
  POS_LOCAL_SCHEMA_V1,
  POS_LOCAL_SCHEMA_V2,
  POS_LOCAL_SCHEMA_V3,
  POS_LOCAL_SCHEMA_V4,
  closePosLocalDatabase,
  deletePosLocalDatabase,
  openPosLocalDatabase,
} from "./pos-local-db";
export { createCartDraftStore, retireCartDraft } from "./cart-draft-store";
export { createOperationJournal, loadJournalPayload } from "./operation-journal";
export {
  applyCatalogIncremental,
  createLocalCatalogPort,
  persistCatalogEngine,
  rebuildCatalogProjection,
  searchLocalCatalog,
} from "./catalog-repository";
export {
  CATALOG_REFRESH_MIN_INTERVAL_MS,
  CATALOG_SYNC_PAGE_LIMIT,
  CATALOG_SYNC_STATE_KEY,
  ensureCatalogProjection,
  inspectLocalCatalogProjection,
  readCatalogSyncState,
  refreshCatalogProjection,
  catalogProjectionSyncApplied,
} from "./catalog-sync";
export type {
  CatalogProjectionAvailability,
  CatalogProjectionSyncResult,
  CatalogSyncPageFetcher,
  CatalogSyncState,
} from "./catalog-sync";
export { createBrowserCatalogSyncClient } from "./catalog-sync-client";
export { createLocalCustomerPort, replaceLocalCustomers } from "./customer-store";
export { rebuildableCatalogClear, recordLocalSchema } from "./pwa-upgrade";
export {
  acquireLifecycleLease,
  assessUpdateActivation,
  compareBuildIds,
  isBelowMinimumSupportedBuild,
  releaseLifecycleLease,
  renewLifecycleLease,
  shouldDiscoverAdvertisedWorker,
  type UpdateActivationDecision,
  type UpdateBlockReason,
  type UpdateSafetySnapshot,
} from "./pwa-lifecycle";
export {
  createServiceWorkerLifecycle,
  type ServiceWorkerLifecycleController,
  type ServiceWorkerLifecycleOptions,
} from "./service-worker-lifecycle";
export { buildMountedSafetySnapshot } from "./mounted-update-safety";
export {
  fetchReleasePolicy,
  RELEASE_POLICY_PATH,
  sameWorkerUrl,
  serviceWorkerUrlForBuild,
} from "./release-policy-client";
export {
  createTenderActivityPort,
  hasActiveTender,
  type TenderActivityPort,
} from "./tender-activity";
export {
  inspectLocalRecoveryState,
  type LocalRecoveryDiagnostics,
} from "./recovery-diagnostics";
export { assertJournalPayloadHasNoSecrets, journalPayloadContainsSecrets } from "./secrets-guard";
export { clearActiveCartId, recallActiveCartId, rememberActiveCartId, replaceActiveCartDraft } from "./active-cart";
export {
  CASHIER_SEED_CATALOG,
  CASHIER_SEED_CUSTOMERS,
  CASHIER_SEED_LOCATION_ID,
  ensureCashierLocalSeed,
} from "./cashier-seed";
