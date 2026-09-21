import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import {
  clearActiveCartId,
  recallActiveCartId,
  rememberActiveCartId,
  replaceActiveCartDraft,
} from "../../../apps/pos-web/src/local/active-cart";
import { createCartDraftStore } from "../../../apps/pos-web/src/local/cart-draft-store";
import { deletePosLocalDatabase, openPosLocalDatabase } from "../../../apps/pos-web/src/local/pos-local-db";
import { rebuildableCatalogClear } from "../../../apps/pos-web/src/local/pwa-upgrade";

const DBS: string[] = [];

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

describe("CORE-04 active cart pointer", () => {
  test("atomically replaces the active draft and survives database reopen", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    const store = createCartDraftStore(db);
    const previousCartId = "11111111-1111-4111-8111-111111111111";
    const nextCartId = "22222222-2222-4222-8222-222222222222";

    await store.save({
      cartId: previousCartId,
      revision: 2,
      customer: { kind: "retail", customerId: "cust-1" },
      locationId: "loc-front-1",
      lines: [
        {
          lineId: "31111111-1111-4111-8111-111111111111",
          productId: "item-1",
          quantity: "1",
        },
      ],
      updatedAt: "2026-09-21T18:00:00.000Z",
    });
    await rememberActiveCartId(previousCartId, db);

    await replaceActiveCartDraft(
      previousCartId,
      {
        cartId: nextCartId,
        revision: 0,
        customer: { kind: "walkin" },
        locationId: "loc-front-1",
        lines: [],
        updatedAt: "2026-09-21T18:01:00.000Z",
      },
      db,
    );

    expect(await recallActiveCartId(db)).toBe(nextCartId);
    expect(await store.load(previousCartId)).toBeNull();
    expect(await store.load(nextCartId)).toMatchObject({ revision: 0, lines: [] });
    expect(await db.cartDrafts.count()).toBe(1);

    db.close();
    const reopened = openPosLocalDatabase(name);
    expect(await recallActiveCartId(reopened)).toBe(nextCartId);
    expect(await createCartDraftStore(reopened).load(previousCartId)).toBeNull();
    expect(await createCartDraftStore(reopened).load(nextCartId)).toMatchObject({
      revision: 0,
      lines: [],
      customer: { kind: "walkin" },
    });
  });

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
