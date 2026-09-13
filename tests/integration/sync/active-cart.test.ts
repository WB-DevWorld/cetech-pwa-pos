import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import {
  clearActiveCartId,
  recallActiveCartId,
  rememberActiveCartId,
} from "../../../apps/pos-web/src/local/active-cart";
import { createCartDraftStore } from "../../../apps/pos-web/src/local/cart-draft-store";
import { deletePosLocalDatabase, openPosLocalDatabase } from "../../../apps/pos-web/src/local/pos-local-db";
import { rebuildableCatalogClear } from "../../../apps/pos-web/src/local/pwa-upgrade";

const DBS: string[] = [];

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

describe("CORE-04 active cart pointer", () => {
  test("survives catalog rebuild and database reopen", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    const cartId = "44444444-4444-4444-8444-444444444444";
    await createCartDraftStore(db).save({
      cartId,
      revision: 2,
      customer: { kind: "walkin" },
      locationId: "loc-front-1",
      lines: [],
      updatedAt: "2026-09-13T20:00:00.000Z",
    });
    await rememberActiveCartId(cartId, db);
    await rebuildableCatalogClear(db);
    db.close();
    const reopened = openPosLocalDatabase(name);
    expect(await recallActiveCartId(reopened)).toBe(cartId);
    expect(await createCartDraftStore(reopened).load(cartId)).toMatchObject({ revision: 2 });
    await clearActiveCartId(reopened);
    expect(await recallActiveCartId(reopened)).toBeNull();
  });
});
