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
      recoverableCartCount: 0,
      pendingOperationCount: 0,
      attentionOperationCount: 0,
      rebuildableCatalogItemCount: 1,
      destructiveResetAllowed: false,
      recommendedActions: ["NONE"],
    });
  });

  test("counts only meaningful active cart work and ignores orphan draft rows", async () => {
    const db = testDb();
    await db.cartDrafts.bulkPut([
      {
        cartId: "11111111-1111-4111-8111-111111111111",
        revision: 3,
        customer: { kind: "walkin" },
        locationId: "loc_a1",
        lines: [
          {
            lineId: "21111111-1111-4111-8111-111111111111",
            productId: "item-orphan",
            quantity: "1",
          },
        ],
        updatedAt: "2026-09-21T12:00:00.000Z",
      },
      {
        cartId: "33333333-3333-4333-8333-333333333333",
        revision: 0,
        customer: { kind: "walkin" },
        locationId: "loc_a1",
        lines: [],
        updatedAt: "2026-09-21T12:01:00.000Z",
      },
    ]);
    await db.kv.put({ key: "active-cart", value: "33333333-3333-4333-8333-333333333333" });

    expect((await inspectLocalRecoveryState(db)).recoverableCartCount).toBe(0);
    expect(await db.cartDrafts.count()).toBe(2);

    await db.cartDrafts.put({
      cartId: "33333333-3333-4333-8333-333333333333",
      revision: 1,
      customer: { kind: "retail", customerId: "cust-active" },
      locationId: "loc_a1",
      lines: [],
      updatedAt: "2026-09-21T12:01:30.000Z",
    });
    expect((await inspectLocalRecoveryState(db)).recoverableCartCount).toBe(1);

    await db.cartDrafts.put({
      cartId: "33333333-3333-4333-8333-333333333333",
      revision: 2,
      customer: { kind: "walkin" },
      locationId: "loc_a1",
      lines: [
        {
          lineId: "43333333-3333-4333-8333-333333333333",
          productId: "item-active",
          quantity: "1",
        },
      ],
      updatedAt: "2026-09-21T12:02:00.000Z",
    });

    expect((await inspectLocalRecoveryState(db)).recoverableCartCount).toBe(1);
    expect(await db.cartDrafts.count()).toBe(2);
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

  test("current R8 journal operations are counted without inventing a second local truth", async () => {
    const db = testDb();
    await db.schemaMeta.put({
      key: "schema",
      localSchema: POS_LOCAL_SCHEMA_CURRENT,
      appBuild: "r9-r8",
    });
    const operations = [
      "payment.initialize",
      "payment.resolve",
      "return.execute",
      "shift.close",
      "payment.refund",
    ] as const;
    for (const [index, operation] of operations.entries()) {
      await db.journal.put({
        id: `11111111-1111-4111-8111-11111111111${index}`,
        operation,
        idempotencyKey: `22222222-2222-4222-8222-22222222222${index}`,
        requestHash: "b".repeat(64),
        payloadVersion: "1.0.0",
        status: "sent",
        attempts: 1,
        createdAt: "2026-09-17T00:00:00.000Z",
        lastAttemptAt: "2026-09-17T00:00:01.000Z",
        payload: "{}",
        attemptHistory: [{ at: "2026-09-17T00:00:00.000Z", status: "sent" }],
      });
    }
    const result = await inspectLocalRecoveryState(db);
    expect(result.pendingOperationCount).toBe(operations.length);
    expect(result.destructiveResetAllowed).toBe(false);
    expect(await db.journal.count()).toBe(operations.length);
  });
});
