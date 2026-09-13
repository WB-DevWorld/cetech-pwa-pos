import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, test } from "vitest";
import { CatalogProjectionEngine } from "../../../apps/pos-web/src/core/catalog/engine";
import { persistCatalogEngine } from "../../../apps/pos-web/src/local/catalog-repository";
import { createCartDraftStore } from "../../../apps/pos-web/src/local/cart-draft-store";
import { canonicalJson, sha256Hex } from "../../../apps/pos-web/src/local/canonical";
import { createOperationJournal } from "../../../apps/pos-web/src/local/operation-journal";
import {
  POS_LOCAL_SCHEMA_CURRENT,
  closePosLocalDatabase,
  deletePosLocalDatabase,
  openPosLocalDatabase,
} from "../../../apps/pos-web/src/local/pos-local-db";
import { rebuildableCatalogClear } from "../../../apps/pos-web/src/local/pwa-upgrade";
import { createSyntheticCatalogRecords } from "./fixtures/synthetic-catalog";

const DBS: string[] = [];

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

describe("CORE-04 PWA update compatibility", () => {
  test("schema upgrade and catalog rebuild do not erase drafts or journal", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    const drafts = createCartDraftStore(db);
    const journal = createOperationJournal(db);
    await drafts.save({
      cartId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      revision: 9,
      customer: { kind: "walkin" },
      locationId: "loc_a1",
      lines: [],
      updatedAt: "2026-09-13T20:00:00.000Z",
    });
    const payload = { kind: "sale.prepare", note: "unacked" };
    const requestHash = await sha256Hex(canonicalJson(payload));
    await journal.appendBeforeSend(
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        operation: "sale.prepare",
        idempotencyKey: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        requestHash,
        payloadVersion: "1.0.0",
        status: "pending",
        attempts: 0,
        createdAt: "2026-09-13T20:00:00.000Z",
      },
      JSON.stringify(payload),
    );
    const engine = new CatalogProjectionEngine();
    engine.rebuild(createSyntheticCatalogRecords(25), "v1", "2026-09-13T20:00:00.000Z");
    await persistCatalogEngine(engine, db);
    await rebuildableCatalogClear(db);
    db.close();
    await closePosLocalDatabase(name);

    class Upgraded extends Dexie {
      constructor() {
        super(name);
        this.version(POS_LOCAL_SCHEMA_CURRENT).stores({
          catalogItems: "id",
          barcodeIndex: "barcode",
          catalogMeta: "key",
          cartDrafts: "cartId",
          journal: "id",
          customers: "id",
          schemaMeta: "key",
        });
        this.version(POS_LOCAL_SCHEMA_CURRENT + 1)
          .stores({
            catalogItems: "id",
            barcodeIndex: "barcode",
            catalogMeta: "key",
            cartDrafts: "cartId",
            journal: "id",
            customers: "id",
            schemaMeta: "key",
            rebuildTokens: "key",
          })
          .upgrade(async () => {
            /* catalog may be rebuilt; drafts/journal must remain */
          });
      }
    }

    const upgraded = new Upgraded();
    await upgraded.open();
    expect(await upgraded.table("cartDrafts").count()).toBe(1);
    expect(await upgraded.table("journal").count()).toBe(1);
    expect(await upgraded.table("catalogItems").count()).toBe(0);
    const draft = await upgraded.table("cartDrafts").get("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(draft?.revision).toBe(9);
    upgraded.close();
  });
});
