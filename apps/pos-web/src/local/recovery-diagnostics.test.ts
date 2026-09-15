import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import { inspectLocalRecoveryState } from "./recovery-diagnostics";
import {
  POS_LOCAL_SCHEMA_CURRENT,
  deletePosLocalDatabase,
  openPosLocalDatabase,
} from "./pos-local-db";

const opened = new Set<string>();

function testDb() {
  const name = `core-07-recovery-${crypto.randomUUID()}`;
  opened.add(name);
  return openPosLocalDatabase(name);
}

afterEach(async () => {
  await Promise.all([...opened].map((name) => deletePosLocalDatabase(name)));
  opened.clear();
});

describe("CORE-07 non-destructive recovery diagnostics", () => {
  test("healthy local state recommends no destructive repair", async () => {
    const db = testDb();
    await db.schemaMeta.put({
      key: "schema",
      localSchema: POS_LOCAL_SCHEMA_CURRENT,
      appBuild: "core-07",
    });
    await db.catalogItems.put({
      id: "item-1",
      name: "Item",
      barcodes: [],
      kind: "simple",
      stockStatus: "unknown",
      projectionUpdatedAt: "2026-09-15T00:00:00.000Z",
      sourceSystem: "transitional-commerce",
      sourceItemId: "item-1",
      sourceVersion: "1",
      searchNormalized: "item",
      tombstoned: false,
      searchGrams: ["ite"],
    });

    expect(await inspectLocalRecoveryState(db)).toMatchObject({
      schemaCompatible: true,
      cartDraftCount: 0,
      pendingOperationCount: 0,
      attentionOperationCount: 0,
      rebuildableCatalogItemCount: 1,
      destructiveResetAllowed: false,
      recommendedActions: ["NONE"],
    });
  });

  test("unresolved journal work is surfaced without deleting durable state", async () => {
    const db = testDb();
    await db.schemaMeta.put({
      key: "schema",
      localSchema: POS_LOCAL_SCHEMA_CURRENT,
      appBuild: "core-07",
    });
    await db.journal.put({
      id: "11111111-1111-4111-8111-111111111111",
      operation: "sale.prepare",
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      requestHash: "a".repeat(64),
      payloadVersion: "1.0.0",
      status: "response_unknown",
      attempts: 1,
      createdAt: "2026-09-15T00:00:00.000Z",
      lastAttemptAt: "2026-09-15T00:00:01.000Z",
      payload: "{}",
      attemptHistory: [
        {
          at: "2026-09-15T00:00:00.000Z",
          status: "response_unknown",
        },
      ],
    });

    const result = await inspectLocalRecoveryState(db);
    expect(result.pendingOperationCount).toBe(1);
    expect(result.attentionOperationCount).toBe(1);
    expect(result.destructiveResetAllowed).toBe(false);
    expect(result.recommendedActions).toEqual([
      "RESOLVE_PENDING_OPERATIONS",
      "REVIEW_ATTENTION_OPERATIONS",
      "REBUILD_CATALOG_IF_NEEDED",
    ]);
    expect(await db.journal.count()).toBe(1);
  });
});
