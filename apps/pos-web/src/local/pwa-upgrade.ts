import {
  openPosLocalDatabase,
  POS_LOCAL_SCHEMA_CURRENT,
  type PosLocalDatabase,
} from "./pos-local-db";

/**
 * Application-update / schema coordination.
 * Catalog is rebuildable. Cart drafts and the operation journal are never cleared here.
 */
export async function recordLocalSchema(
  db: PosLocalDatabase = openPosLocalDatabase(),
  appBuild = "core-04",
): Promise<void> {
  await db.schemaMeta.put({
    key: "schema",
    localSchema: POS_LOCAL_SCHEMA_CURRENT,
    appBuild,
  });
}

export async function countDurableIntent(db: PosLocalDatabase = openPosLocalDatabase()): Promise<{
  readonly drafts: number;
  readonly journal: number;
  readonly catalogItems: number;
}> {
  return {
    drafts: await db.cartDrafts.count(),
    journal: await db.journal.count(),
    catalogItems: await db.catalogItems.count(),
  };
}

export async function rebuildableCatalogClear(db: PosLocalDatabase = openPosLocalDatabase()): Promise<void> {
  await db.transaction("rw", db.catalogItems, db.barcodeIndex, db.catalogMeta, async () => {
    await db.catalogItems.clear();
    await db.barcodeIndex.clear();
    await db.catalogMeta.clear();
  });
}
