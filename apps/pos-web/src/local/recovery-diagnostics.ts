import {
  POS_LOCAL_SCHEMA_CURRENT,
  openPosLocalDatabase,
  type PosLocalDatabase,
} from "./pos-local-db";

export interface LocalRecoveryDiagnostics {
  readonly localSchema: number;
  readonly expectedSchema: number;
  readonly schemaCompatible: boolean;
  readonly cartDraftCount: number;
  readonly pendingOperationCount: number;
  readonly attentionOperationCount: number;
  readonly rebuildableCatalogItemCount: number;
  readonly destructiveResetAllowed: false;
  readonly recommendedActions: ReadonlyArray<
    | "RESOLVE_PENDING_OPERATIONS"
    | "REVIEW_ATTENTION_OPERATIONS"
    | "MIGRATE_LOCAL_SCHEMA"
    | "REBUILD_CATALOG_IF_NEEDED"
    | "NONE"
  >;
}

/**
 * Read-only recovery inspection. This deliberately never clears IndexedDB, carts,
 * journal entries, auth/session data, or caches as a side effect.
 */
export async function inspectLocalRecoveryState(
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<LocalRecoveryDiagnostics> {
  const schemaRow = await db.schemaMeta.get("schema");
  const localSchema = schemaRow?.localSchema ?? POS_LOCAL_SCHEMA_CURRENT;
  const journalRows = await db.journal.toArray();
  const pendingOperationCount = journalRows.filter((row) => row.status !== "acknowledged").length;
  const attentionOperationCount = journalRows.filter(
    (row) => row.status === "requires_attention" || row.status === "response_unknown",
  ).length;
  const cartDraftCount = await db.cartDrafts.count();
  const rebuildableCatalogItemCount = await db.catalogItems.count();
  const schemaCompatible = localSchema === POS_LOCAL_SCHEMA_CURRENT;

  const actions: LocalRecoveryDiagnostics["recommendedActions"][number][] = [];
  if (!schemaCompatible) {
    actions.push("MIGRATE_LOCAL_SCHEMA");
  }
  if (pendingOperationCount > 0) {
    actions.push("RESOLVE_PENDING_OPERATIONS");
  }
  if (attentionOperationCount > 0) {
    actions.push("REVIEW_ATTENTION_OPERATIONS");
  }
  if (rebuildableCatalogItemCount === 0) {
    actions.push("REBUILD_CATALOG_IF_NEEDED");
  }
  if (actions.length === 0) {
    actions.push("NONE");
  }

  return {
    localSchema,
    expectedSchema: POS_LOCAL_SCHEMA_CURRENT,
    schemaCompatible,
    cartDraftCount,
    pendingOperationCount,
    attentionOperationCount,
    rebuildableCatalogItemCount,
    destructiveResetAllowed: false,
    recommendedActions: actions,
  };
}
