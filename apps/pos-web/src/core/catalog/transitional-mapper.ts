import type { CatalogItem, Id } from "../../../../../docs/contracts/domain.generated";
import { normalizeSearchText, preserveBarcode } from "./normalize";
import type { CatalogSourceRecord } from "./source";

/**
 * Maps a transitional commerce catalog row into a provider-neutral source record.
 * Callers supply opaque POS ids. Numeric provider ids never become CatalogItem.id.
 */
export type TransitionalCatalogInput = {
  readonly posItemId: Id;
  readonly sourceItemId: string;
  readonly sourceVersion: string;
  readonly sourceSystem?: string;
  readonly name: string;
  readonly sku?: string;
  readonly barcodes?: ReadonlyArray<string | number>;
  readonly kind: CatalogItem["kind"];
  readonly parentId?: Id;
  readonly variationLabel?: string;
  readonly listPriceMinor?: number;
  readonly listPriceCurrency?: string;
  readonly purchasable?: boolean;
  readonly catalogStockStatus?: CatalogItem["stockStatus"];
  readonly sourceUpdatedAt: string;
  readonly deleted?: boolean;
};

const SOURCE_SYSTEM = "transitional-commerce";

export function mapTransitionalCatalogItem(input: TransitionalCatalogInput): CatalogSourceRecord {
  const barcodes = (input.barcodes ?? []).map((code) => preserveBarcode(String(code))).filter((code) => code.length > 0);
  return {
    posItemId: input.posItemId,
    sourceSystem: input.sourceSystem ?? SOURCE_SYSTEM,
    sourceItemId: String(input.sourceItemId),
    sourceVersion: input.sourceVersion,
    name: input.name,
    sku: input.sku === undefined ? undefined : preserveBarcode(String(input.sku)),
    barcodes,
    kind: input.kind,
    parentId: input.parentId,
    variationLabel: input.variationLabel,
    displayPrice:
      input.listPriceMinor !== undefined && input.listPriceCurrency
        ? { minor: input.listPriceMinor, currency: input.listPriceCurrency }
        : undefined,
    purchasable: input.purchasable,
    stockStatus: input.catalogStockStatus ?? "unknown",
    sourceUpdatedAt: input.sourceUpdatedAt,
    deleted: input.deleted,
  };
}

export function mapTransitionalCatalogBatch(
  inputs: ReadonlyArray<TransitionalCatalogInput>,
): ReadonlyArray<CatalogSourceRecord> {
  return inputs.map(mapTransitionalCatalogItem);
}

export function searchDocumentFor(record: Pick<CatalogSourceRecord, "name" | "sku" | "barcodes" | "variationLabel">): string {
  return normalizeSearchText(record.name, record.sku, record.variationLabel, ...record.barcodes);
}
