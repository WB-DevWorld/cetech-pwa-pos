export { CatalogProjectionEngine, emptyProjectionMeta } from "./engine";
export { mapTransitionalCatalogBatch, mapTransitionalCatalogItem } from "./transitional-mapper";
export { normalizeSearchText, preserveBarcode } from "./normalize";
export {
  catalogSourcePolicyAllowsSynthetic,
  resolveBrowserCatalogSourcePolicy,
  resolveCatalogAppEnv,
  resolveCatalogSourcePolicy,
} from "./source-policy";
export type { CatalogAppEnv, CatalogSourcePolicy } from "./source-policy";
export type { CatalogSyncPage } from "./sync-page";
export {
  catalogSearchGrams,
  pickIndexedSearchGram,
  projectedToCatalogItem,
  resolveCatalogSearchLimit,
} from "./query";
export type {
  BarcodeLookup,
  CatalogProjectionMeta,
  CatalogSourceRecord,
  ProjectedCatalogItem,
} from "./source";
