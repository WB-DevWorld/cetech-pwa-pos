import type { CatalogPort } from "../../../../docs/contracts/ports";
import type { Uuid } from "../../../../docs/contracts/domain.generated";
import { CatalogProjectionEngine, emptyProjectionMeta } from "../core/catalog/engine";
import type { CatalogSourceRecord } from "../core/catalog/source";
import { openPosLocalDatabase, type PosLocalDatabase } from "./pos-local-db";

export async function loadCatalogEngine(db: PosLocalDatabase = openPosLocalDatabase()): Promise<CatalogProjectionEngine> {
  const engine = new CatalogProjectionEngine();
  const items = await db.catalogItems.toArray();
  const meta = (await db.catalogMeta.get("catalog")) ?? emptyProjectionMeta(new Date().toISOString());
  engine.replaceSnapshot({ items, meta });
  return engine;
}

export async function persistCatalogEngine(
  engine: CatalogProjectionEngine,
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<void> {
  const snapshot = engine.snapshot();
  await db.transaction("rw", db.catalogItems, db.barcodeIndex, db.catalogMeta, async () => {
    await db.catalogItems.clear();
    await db.barcodeIndex.clear();
    if (snapshot.items.length > 0) {
      await db.catalogItems.bulkPut(snapshot.items);
    }
    const barcodeMap = new Map<string, string[]>();
    for (const item of snapshot.items) {
      if (item.tombstoned) {
        continue;
      }
      for (const barcode of item.barcodes) {
        const list = barcodeMap.get(barcode) ?? [];
        list.push(item.id);
        barcodeMap.set(barcode, list);
      }
    }
    if (barcodeMap.size > 0) {
      await db.barcodeIndex.bulkPut(
        [...barcodeMap.entries()].map(([barcode, itemIds]) => ({ barcode, itemIds })),
      );
    }
    await db.catalogMeta.put({ key: "catalog", ...snapshot.meta });
  });
}

export async function rebuildCatalogProjection(
  records: ReadonlyArray<CatalogSourceRecord>,
  sourceVersion: string,
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<CatalogProjectionEngine> {
  const engine = await loadCatalogEngine(db);
  engine.rebuild(records, sourceVersion, new Date().toISOString());
  await persistCatalogEngine(engine, db);
  return engine;
}

export async function applyCatalogIncremental(
  records: ReadonlyArray<CatalogSourceRecord>,
  sourceVersion: string,
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<CatalogProjectionEngine> {
  const engine = await loadCatalogEngine(db);
  engine.applyIncremental(records, sourceVersion, new Date().toISOString());
  await persistCatalogEngine(engine, db);
  return engine;
}

export function createLocalCatalogPort(
  options: {
    readonly db?: PosLocalDatabase;
    readonly correlationId?: () => Uuid;
  } = {},
): CatalogPort {
  const db = options.db ?? openPosLocalDatabase();
  const correlationId = options.correlationId ?? (() => crypto.randomUUID());
  return {
    async search(input) {
      const engine = await loadCatalogEngine(db);
      return {
        ok: true,
        data: engine.search(input),
        correlationId: correlationId(),
      };
    },
  };
}
