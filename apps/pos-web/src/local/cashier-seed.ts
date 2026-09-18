import type { CustomerSummary } from "../../../../docs/contracts/domain.generated";
import {
  catalogSourcePolicyAllowsSynthetic,
  type CatalogSourcePolicy,
} from "../core/catalog/source-policy";
import { mapTransitionalCatalogBatch, type TransitionalCatalogInput } from "../core/catalog/transitional-mapper";
import { rebuildCatalogProjection } from "./catalog-repository";
import { replaceLocalCustomers } from "./customer-store";
import { openPosLocalDatabase, type PosLocalDatabase } from "./pos-local-db";

const CASHIER_SOURCE_VERSION = "ux02-cashier-synthetic-v2";
const SEEDED_KEY = "cashier-seed-version";

/** Non-PII synthetic cashier catalog. Not a production/Woo copy. */
export const CASHIER_SEED_CATALOG: readonly TransitionalCatalogInput[] = [
  {
    posItemId: "p-leading-zero",
    sourceItemId: "src-leading-zero",
    sourceVersion: CASHIER_SOURCE_VERSION,
    name: "Leading-zero sample",
    sku: "LZ-001",
    barcodes: ["0012345"],
    kind: "simple",
    catalogStockStatus: "in_stock",
    sourceUpdatedAt: "2026-09-13T20:00:00.000Z",
  },
  {
    posItemId: "p-hardener",
    sourceItemId: "src-hardener",
    sourceVersion: CASHIER_SOURCE_VERSION,
    name: "Epoxy Hardener 1L",
    sku: "HDN-1L",
    barcodes: ["0012345678901"],
    kind: "simple",
    catalogStockStatus: "in_stock",
    listPriceMinor: 15500,
    listPriceCurrency: "GHS",
    sourceUpdatedAt: "2026-09-13T20:00:00.000Z",
  },
  {
    posItemId: "p-cable",
    sourceItemId: "src-cable",
    sourceVersion: CASHIER_SOURCE_VERSION,
    name: "Armoured Cable",
    sku: "CBL-ARM",
    barcodes: ["0011223344556"],
    kind: "variable",
    catalogStockStatus: "in_stock",
    sourceUpdatedAt: "2026-09-13T20:00:00.000Z",
  },
  {
    posItemId: "v-cable-red",
    sourceItemId: "src-cable-red",
    sourceVersion: CASHIER_SOURCE_VERSION,
    name: "Armoured Cable",
    sku: "CBL-ARM-RED",
    barcodes: ["0001112223334"],
    kind: "variation",
    parentId: "p-cable",
    variationLabel: "Red",
    catalogStockStatus: "in_stock",
    sourceUpdatedAt: "2026-09-13T20:00:00.000Z",
  },
  {
    posItemId: "v-cable-black",
    sourceItemId: "src-cable-black",
    sourceVersion: CASHIER_SOURCE_VERSION,
    name: "Armoured Cable",
    sku: "CBL-ARM-BLK",
    barcodes: ["0001112223335"],
    kind: "variation",
    parentId: "p-cable",
    variationLabel: "Black",
    catalogStockStatus: "in_stock",
    sourceUpdatedAt: "2026-09-13T20:00:00.000Z",
  },
  {
    posItemId: "p-led",
    sourceItemId: "src-led",
    sourceVersion: CASHIER_SOURCE_VERSION,
    name: "36W LED Panel Light",
    sku: "LED-36",
    barcodes: ["5550001112223"],
    kind: "simple",
    catalogStockStatus: "in_stock",
    listPriceMinor: 21500,
    listPriceCurrency: "GHS",
    sourceUpdatedAt: "2026-09-13T20:00:00.000Z",
  },
  {
    posItemId: "p-db",
    sourceItemId: "src-db",
    sourceVersion: CASHIER_SOURCE_VERSION,
    name: "12-Way Distribution Board",
    sku: "DB-12",
    barcodes: ["5550001112223"],
    kind: "simple",
    catalogStockStatus: "in_stock",
    sourceUpdatedAt: "2026-09-13T20:00:00.000Z",
  },
  {
    posItemId: "p-conduit",
    sourceItemId: "src-conduit",
    sourceVersion: CASHIER_SOURCE_VERSION,
    name: "Steel Conduit 20mm",
    sku: "CND-20",
    barcodes: ["0099887766554"],
    kind: "simple",
    catalogStockStatus: "backorder",
    sourceUpdatedAt: "2026-09-13T20:00:00.000Z",
  },
];

export const CASHIER_SEED_CUSTOMERS: readonly CustomerSummary[] = [
  { id: "cust-ada", kind: "retail", displayName: "Ada Boateng" },
  {
    id: "cust-buildworks",
    kind: "b2b",
    displayName: "Buildworks Ltd",
    company: "Buildworks Ltd",
    phoneMasked: "+233 •• ••• 4488",
  },
];

export const CASHIER_SEED_LOCATION_ID = "loc-front-1";

/**
 * Idempotent local projection/customer seed for local/test/demo Sell runtime.
 * Staging/production-intent must not call this as a silent fallback.
 * Does not copy production catalog or live inventory.
 */
export async function ensureCashierLocalSeed(
  db: PosLocalDatabase = openPosLocalDatabase(),
  options: { readonly policy?: CatalogSourcePolicy } = {},
): Promise<void> {
  const policy = options.policy ?? "synthetic_permitted";
  if (!catalogSourcePolicyAllowsSynthetic(policy)) {
    return;
  }
  const already = await db.kv.get(SEEDED_KEY);
  if (already?.value === CASHIER_SOURCE_VERSION) {
    const itemCount = await db.catalogItems.count();
    if (itemCount > 0) {
      return;
    }
  }
  await rebuildCatalogProjection(mapTransitionalCatalogBatch(CASHIER_SEED_CATALOG), CASHIER_SOURCE_VERSION, db);
  await replaceLocalCustomers(CASHIER_SEED_CUSTOMERS, db);
  await db.kv.put({ key: SEEDED_KEY, value: CASHIER_SOURCE_VERSION });
}
