import type { ProductDisplayPriceView } from "../state/variableDisplayPrice";

/**
 * Local non-contract generation. First observation records the value; later
 * changes return true so presentation caches/results can refresh.
 */
export function bindLocalGeneration(
  observedGeneration: { current: number | undefined },
  generation: number,
): boolean {
  if (observedGeneration.current === undefined) {
    observedGeneration.current = generation;
    return false;
  }
  if (observedGeneration.current === generation) {
    return false;
  }
  observedGeneration.current = generation;
  return true;
}

/**
 * Presentation-only cache. Invalidation is driven by a local projection generation,
 * not CatalogPort identity or catalogAvailability.
 */
export function bindPriceCacheToGeneration(
  cache: Map<string, ProductDisplayPriceView>,
  observedGeneration: { current: number | undefined },
  generation: number,
): boolean {
  if (!bindLocalGeneration(observedGeneration, generation)) {
    return false;
  }
  cache.clear();
  return true;
}
