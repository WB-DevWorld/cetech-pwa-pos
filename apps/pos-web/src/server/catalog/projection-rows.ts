import type { CatalogSourceRecord } from "../../core/catalog/source";
import { searchDocumentFor } from "../../core/catalog/transitional-mapper";

/** SQL-shaped rebuildable projection row. Not a commerce master and not live inventory. */
export type CatalogProjectionRow = {
  readonly organizationId: string;
  readonly itemId: string;
  readonly sourceSystem: string;
  readonly sourceItemId: string;
  readonly sourceVersion: string;
  readonly projectionVersion: number;
  readonly parentId?: string;
  readonly kind: CatalogSourceRecord["kind"];
  readonly name: string;
  readonly sku?: string;
  readonly barcodes: ReadonlyArray<string>;
  readonly searchNormalized: string;
  readonly variationLabel?: string;
  readonly displayPriceMinor?: number;
  readonly displayCurrency?: string;
  readonly stockStatus: CatalogSourceRecord["stockStatus"];
  readonly tombstonedAt?: string;
  readonly projectionUpdatedAt: string;
};

export function toCatalogProjectionRow(
  organizationId: string,
  record: CatalogSourceRecord,
  projectionVersion: number,
  projectionUpdatedAt: string,
): CatalogProjectionRow {
  return {
    organizationId,
    itemId: record.posItemId,
    sourceSystem: record.sourceSystem,
    sourceItemId: record.sourceItemId,
    sourceVersion: record.sourceVersion,
    projectionVersion,
    parentId: record.parentId,
    kind: record.kind,
    name: record.name,
    sku: record.sku,
    barcodes: record.deleted ? [] : [...record.barcodes],
    searchNormalized: record.deleted ? "" : searchDocumentFor(record),
    variationLabel: record.variationLabel,
    displayPriceMinor: record.displayPrice?.minor,
    displayCurrency: record.displayPrice?.currency,
    stockStatus: record.stockStatus,
    tombstonedAt: record.deleted ? projectionUpdatedAt : undefined,
    projectionUpdatedAt,
  };
}
