/**
 * Provider-neutral sale-time catalog presentation.
 * Not commerce/pricing authority. Not a second Woo master.
 */
export type CatalogPresentationItem = {
  readonly id: string;
  readonly name: string;
  readonly sku?: string;
  readonly kind: "simple" | "variable" | "variation";
  readonly parentId?: string;
  readonly variationLabel?: string;
};

export interface CatalogPresentationLookup {
  getItems(
    organizationId: string,
    itemIds: readonly string[],
  ): Promise<ReadonlyMap<string, CatalogPresentationItem>>;
}

export interface MutableCatalogPresentationLookup extends CatalogPresentationLookup {
  seed(organizationId: string, items: readonly CatalogPresentationItem[]): void;
}

export function createMemoryCatalogPresentationLookup(
  initial: Readonly<Record<string, readonly CatalogPresentationItem[]>> = {},
): MutableCatalogPresentationLookup {
  const byOrg = new Map<string, Map<string, CatalogPresentationItem>>();
  for (const [organizationId, items] of Object.entries(initial)) {
    const map = new Map<string, CatalogPresentationItem>();
    for (const item of items) {
      map.set(item.id, item);
    }
    byOrg.set(organizationId, map);
  }
  return {
    seed(organizationId, items) {
      const map = byOrg.get(organizationId) ?? new Map<string, CatalogPresentationItem>();
      for (const item of items) {
        map.set(item.id, item);
      }
      byOrg.set(organizationId, map);
    },
    async getItems(organizationId, itemIds) {
      const map = byOrg.get(organizationId) ?? new Map<string, CatalogPresentationItem>();
      const found = new Map<string, CatalogPresentationItem>();
      for (const id of itemIds) {
        const item = map.get(id);
        if (item) {
          found.set(id, item);
        }
      }
      return found;
    },
  };
}
