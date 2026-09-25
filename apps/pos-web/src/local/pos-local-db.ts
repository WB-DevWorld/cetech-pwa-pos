import Dexie, { type EntityTable } from "dexie";
import { catalogSearchGrams } from "../core/catalog/query";
import type { CatalogProjectionMeta, ProjectedCatalogItem } from "../core/catalog/source";
import type { CartDraft, CustomerSummary, PendingOperation } from "../../../../docs/contracts/domain.generated";
import { deriveRecoveryScopeFromPayload, mergeRecoveryScope, type JournalRecoveryScope } from "./journal-recovery-scope";

export const POS_LOCAL_DB_NAME = "cetech-pos-local";
export const POS_LOCAL_SCHEMA_V1 = 1;
export const POS_LOCAL_SCHEMA_V2 = 2;
export const POS_LOCAL_SCHEMA_V3 = 3;
export const POS_LOCAL_SCHEMA_V4 = 4;
export const POS_LOCAL_SCHEMA_V5 = 5;
export const POS_LOCAL_SCHEMA_CURRENT = POS_LOCAL_SCHEMA_V5;

export type CatalogMetaRow = CatalogProjectionMeta & { readonly key: "catalog" };
export type BarcodeIndexRow = { readonly barcode: string; readonly itemIds: ReadonlyArray<string> };
export type CatalogItemRow = ProjectedCatalogItem & {
  readonly searchGrams?: ReadonlyArray<string>;
};
export type JournalRecord = PendingOperation & {
  readonly payload: string;
  readonly attemptHistory: ReadonlyArray<{
    readonly at: string;
    readonly status: PendingOperation["status"];
    readonly errorCode?: string;
  }>;
  readonly recoveryScope?: JournalRecoveryScope;
};
export type SchemaMetaRow = { readonly key: "schema"; readonly localSchema: number; readonly appBuild: string };
export type KvRow = { readonly key: string; readonly value: string };

export class PosLocalDatabase extends Dexie {
  catalogItems!: EntityTable<CatalogItemRow, "id">;
  barcodeIndex!: EntityTable<BarcodeIndexRow, "barcode">;
  catalogMeta!: EntityTable<CatalogMetaRow, "key">;
  cartDrafts!: EntityTable<CartDraft, "cartId">;
  journal!: EntityTable<JournalRecord, "id">;
  customers!: EntityTable<CustomerSummary & { readonly searchNormalized: string }, "id">;
  schemaMeta!: EntityTable<SchemaMetaRow, "key">;
  kv!: EntityTable<KvRow, "key">;

  constructor(name = POS_LOCAL_DB_NAME) {
    super(name);
    this.version(POS_LOCAL_SCHEMA_V1).stores({
      catalogItems: "id, parentId, kind, searchNormalized, tombstoned, sourceItemId",
      barcodeIndex: "barcode",
      catalogMeta: "key",
      cartDrafts: "cartId, updatedAt",
      journal: "id, status, idempotencyKey, transactionId, operation, [operation+idempotencyKey]",
      customers: "id, searchNormalized",
      schemaMeta: "key",
    });
    this.version(POS_LOCAL_SCHEMA_V2)
      .stores({
        catalogItems: "id, parentId, kind, searchNormalized, tombstoned, sourceItemId",
        barcodeIndex: "barcode",
        catalogMeta: "key",
        cartDrafts: "cartId, updatedAt",
        journal: "id, status, idempotencyKey, transactionId, operation, [operation+idempotencyKey]",
        customers: "id, searchNormalized",
        schemaMeta: "key",
      })
      .upgrade(async (tx) => {
        const meta = tx.table("schemaMeta");
        await meta.put({ key: "schema", localSchema: POS_LOCAL_SCHEMA_V2, appBuild: "core-04" });
      });
    this.version(POS_LOCAL_SCHEMA_V3)
      .stores({
        catalogItems: "id, parentId, kind, searchNormalized, tombstoned, sourceItemId",
        barcodeIndex: "barcode",
        catalogMeta: "key",
        cartDrafts: "cartId, updatedAt",
        journal: "id, status, idempotencyKey, transactionId, operation, [operation+idempotencyKey]",
        customers: "id, searchNormalized",
        schemaMeta: "key",
        kv: "key",
      })
      .upgrade(async (tx) => {
        const meta = tx.table("schemaMeta");
        await meta.put({ key: "schema", localSchema: POS_LOCAL_SCHEMA_V3, appBuild: "core-04" });
      });
    this.version(POS_LOCAL_SCHEMA_V4)
      .stores({
        catalogItems: "id, parentId, kind, searchNormalized, tombstoned, sourceItemId, *searchGrams",
        barcodeIndex: "barcode",
        catalogMeta: "key",
        cartDrafts: "cartId, updatedAt",
        journal: "id, status, idempotencyKey, transactionId, operation, [operation+idempotencyKey]",
        customers: "id, searchNormalized",
        schemaMeta: "key",
        kv: "key",
      })
      .upgrade(async (tx) => {
        await tx
          .table("catalogItems")
          .toCollection()
          .modify((row: CatalogItemRow) => {
            const grams = row.tombstoned
              ? []
              : catalogSearchGrams(row.searchNormalized, row.barcodes);
            Object.assign(row, { searchGrams: grams });
          });
        await tx.table("schemaMeta").put({
          key: "schema",
          localSchema: POS_LOCAL_SCHEMA_V4,
          appBuild: "harden-01",
        });
      });
    this.version(POS_LOCAL_SCHEMA_V5)
      .stores({
        catalogItems: "id, parentId, kind, searchNormalized, tombstoned, sourceItemId, *searchGrams",
        barcodeIndex: "barcode",
        catalogMeta: "key",
        cartDrafts: "cartId, updatedAt",
        journal: "id, status, idempotencyKey, transactionId, operation, [operation+idempotencyKey]",
        customers: "id, searchNormalized",
        schemaMeta: "key",
        kv: "key",
      })
      .upgrade(async (tx) => {
        await tx
          .table("journal")
          .toCollection()
          .modify((row: JournalRecord) => {
            const derived = deriveRecoveryScopeFromPayload(row.payload);
            const merged = mergeRecoveryScope(row.recoveryScope, derived);
            const scope: JournalRecoveryScope = {};
            if (merged.registerId) Object.assign(scope, { registerId: merged.registerId });
            if (merged.deviceId) Object.assign(scope, { deviceId: merged.deviceId });
            if (merged.locationId) Object.assign(scope, { locationId: merged.locationId });
            if (merged.organizationId) Object.assign(scope, { organizationId: merged.organizationId });
            if (row.recoveryScope?.createdByActorId) {
              Object.assign(scope, { createdByActorId: row.recoveryScope.createdByActorId });
            }
            if (Object.keys(scope).length > 0) {
              Object.assign(row, { recoveryScope: scope });
            }
          });
        await tx.table("schemaMeta").put({
          key: "schema",
          localSchema: POS_LOCAL_SCHEMA_V5,
          appBuild: "can-01",
        });
      });
  }
}

const openDatabases = new Map<string, PosLocalDatabase>();

export function openPosLocalDatabase(name = POS_LOCAL_DB_NAME): PosLocalDatabase {
  const existing = openDatabases.get(name);
  if (existing?.isOpen()) {
    return existing;
  }
  const db = new PosLocalDatabase(name);
  openDatabases.set(name, db);
  return db;
}

export async function closePosLocalDatabase(name = POS_LOCAL_DB_NAME): Promise<void> {
  const db = openDatabases.get(name);
  if (!db) {
    return;
  }
  db.close();
  openDatabases.delete(name);
}

export async function deletePosLocalDatabase(name = POS_LOCAL_DB_NAME): Promise<void> {
  await closePosLocalDatabase(name);
  await Dexie.delete(name);
}
