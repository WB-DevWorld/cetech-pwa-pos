export { CatalogProjectionEngine, emptyProjectionMeta } from "./engine";
export { mapTransitionalCatalogBatch, mapTransitionalCatalogItem } from "./transitional-mapper";
export { normalizeSearchText, preserveBarcode } from "./normalize";
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
