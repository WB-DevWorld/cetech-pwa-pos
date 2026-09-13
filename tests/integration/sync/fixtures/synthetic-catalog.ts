import { mapTransitionalCatalogItem } from "../../../../apps/pos-web/src/core/catalog/transitional-mapper";
import type { CatalogSourceRecord } from "../../../../apps/pos-web/src/core/catalog/source";

export const SYNTHETIC_CATALOG_COUNT = 5000;
export const LEADING_ZERO_BARCODE = "0001234567890";
export const DUPLICATE_BARCODE = "DUP000000001";
export const EXACT_VARIATION_BARCODE = "VAR000000042";
export const TOMBSTONE_ITEM_ID = "item-0000008";
export const VARIABLE_PARENT_ID = "item-0000005";
export const EXACT_VARIATION_ID = "item-0000006";
export const LEADING_ZERO_ITEM_ID = "item-0000001";
export const DUPLICATE_ITEM_A_ID = "item-0000002";
export const DUPLICATE_ITEM_B_ID = "item-0000003";
export const MISSING_BARCODE_ITEM_ID = "item-0000004";

function padItem(index: number): string {
  return `item-${String(index).padStart(7, "0")}`;
}

function iso(stamp: string): string {
  return stamp;
}

/**
 * Non-PII synthetic catalog. Names are generated labels only.
 * No production customers, orders, or live catalog copy.
 */
export function createSyntheticCatalogRecords(
  count = SYNTHETIC_CATALOG_COUNT,
): CatalogSourceRecord[] {
  if (count < 10) {
    throw new Error("synthetic catalog fixture requires at least 10 items");
  }
  const updatedAt = iso("2026-09-13T20:00:00.000Z");
  const records: CatalogSourceRecord[] = [];
  records.push(
    mapTransitionalCatalogItem({
      posItemId: LEADING_ZERO_ITEM_ID,
      sourceItemId: "src-leading-zero",
      sourceVersion: "1",
      name: "Synthetic leading-zero barcode item",
      sku: "0001234567890",
      barcodes: [LEADING_ZERO_BARCODE],
      kind: "simple",
      sourceUpdatedAt: updatedAt,
    }),
    mapTransitionalCatalogItem({
      posItemId: DUPLICATE_ITEM_A_ID,
      sourceItemId: "src-dup-a",
      sourceVersion: "1",
      name: "Synthetic duplicate barcode A",
      sku: "SKU-DUP-A",
      barcodes: [DUPLICATE_BARCODE],
      kind: "simple",
      sourceUpdatedAt: updatedAt,
    }),
    mapTransitionalCatalogItem({
      posItemId: DUPLICATE_ITEM_B_ID,
      sourceItemId: "src-dup-b",
      sourceVersion: "1",
      name: "Synthetic duplicate barcode B",
      sku: "SKU-DUP-B",
      barcodes: [DUPLICATE_BARCODE],
      kind: "simple",
      sourceUpdatedAt: updatedAt,
    }),
    mapTransitionalCatalogItem({
      posItemId: MISSING_BARCODE_ITEM_ID,
      sourceItemId: "src-missing-barcode",
      sourceVersion: "1",
      name: "Synthetic item without barcode",
      sku: "SKU-NO-BARCODE",
      barcodes: [],
      kind: "simple",
      sourceUpdatedAt: updatedAt,
    }),
    mapTransitionalCatalogItem({
      posItemId: VARIABLE_PARENT_ID,
      sourceItemId: "src-variable-parent",
      sourceVersion: "1",
      name: "Synthetic variable parent",
      sku: "SKU-VAR-PARENT",
      barcodes: [],
      kind: "variable",
      sourceUpdatedAt: updatedAt,
    }),
    mapTransitionalCatalogItem({
      posItemId: EXACT_VARIATION_ID,
      sourceItemId: "src-variation-exact",
      sourceVersion: "1",
      name: "Synthetic variable parent",
      sku: "SKU-VAR-RED",
      barcodes: [EXACT_VARIATION_BARCODE],
      kind: "variation",
      parentId: VARIABLE_PARENT_ID,
      variationLabel: "Red",
      sourceUpdatedAt: updatedAt,
    }),
    mapTransitionalCatalogItem({
      posItemId: "item-0000007",
      sourceItemId: "src-variation-blue",
      sourceVersion: "1",
      name: "Synthetic variable parent",
      sku: "SKU-VAR-BLUE",
      barcodes: ["VAR000000043"],
      kind: "variation",
      parentId: VARIABLE_PARENT_ID,
      variationLabel: "Blue",
      sourceUpdatedAt: updatedAt,
    }),
    mapTransitionalCatalogItem({
      posItemId: TOMBSTONE_ITEM_ID,
      sourceItemId: "src-tombstone",
      sourceVersion: "1",
      name: "Synthetic item later tombstoned",
      sku: "SKU-TOMBSTONE",
      barcodes: ["TOM000000001"],
      kind: "simple",
      sourceUpdatedAt: updatedAt,
    }),
  );

  for (let index = 9; index <= count; index += 1) {
    const id = padItem(index);
    records.push(
      mapTransitionalCatalogItem({
        posItemId: id,
        sourceItemId: `src-${id}`,
        sourceVersion: "1",
        name: `Synthetic bulk item ${index}`,
        sku: `SKU-${String(index).padStart(7, "0")}`,
        barcodes: [`B${String(index).padStart(12, "0")}`],
        kind: "simple",
        sourceUpdatedAt: updatedAt,
      }),
    );
  }
  return records;
}

export function createTombstoneUpdate(): CatalogSourceRecord {
  return mapTransitionalCatalogItem({
    posItemId: TOMBSTONE_ITEM_ID,
    sourceItemId: "src-tombstone",
    sourceVersion: "2",
    name: "Synthetic item later tombstoned",
    sku: "SKU-TOMBSTONE",
    barcodes: ["TOM000000001"],
    kind: "simple",
    sourceUpdatedAt: iso("2026-09-13T20:05:00.000Z"),
    deleted: true,
  });
}
