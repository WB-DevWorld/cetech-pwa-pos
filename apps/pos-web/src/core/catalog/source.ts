import type { CatalogItem, Id, Money, StockStatus, Timestamp } from "../../../../../docs/contracts/domain.generated";

/**
 * Provider-neutral catalog source record.
 * Transitional commerce adapters map into this shape. Woo IDs are not CatalogItem.id.
 * Live inventory is not a field here.
 */
export type CatalogSourceRecord = {
  readonly posItemId: Id;
  readonly sourceSystem: string;
  readonly sourceItemId: string;
  readonly sourceVersion: string;
  readonly name: string;
  readonly sku?: string;
  readonly barcodes: ReadonlyArray<string>;
  readonly kind: CatalogItem["kind"];
  readonly parentId?: Id;
  readonly variationLabel?: string;
  readonly displayPrice?: Money;
  readonly stockStatus: StockStatus;
  readonly sourceUpdatedAt: Timestamp;
  readonly deleted?: boolean;
};

export type CatalogProjectionMeta = {
  readonly projectionVersion: number;
  readonly sourceVersion: string;
  readonly sourceSystem: string;
  readonly updatedAt: Timestamp;
  readonly itemCount: number;
};

export type BarcodeLookup =
  | { readonly status: "missing"; readonly barcode: string }
  | { readonly status: "unique"; readonly barcode: string; readonly item: CatalogItem }
  | { readonly status: "duplicate"; readonly barcode: string; readonly items: ReadonlyArray<CatalogItem> };

export type ProjectedCatalogItem = CatalogItem & {
  readonly sourceSystem: string;
  readonly sourceItemId: string;
  readonly sourceVersion: string;
  readonly searchNormalized: string;
  readonly tombstoned: boolean;
};
