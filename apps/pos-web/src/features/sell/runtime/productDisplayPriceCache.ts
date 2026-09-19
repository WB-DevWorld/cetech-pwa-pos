import type { ProductDisplayPriceView } from "../state/variableDisplayPrice";

/**
 * Presentation-only cache. Invalidation is driven by a local projection generation,
 * not CatalogPort identity or catalogAvailability.
 */
export function bindPriceCacheToGeneration(
  cache: Map<string, ProductDisplayPriceView>,
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
  cache.clear();
  return true;
}
