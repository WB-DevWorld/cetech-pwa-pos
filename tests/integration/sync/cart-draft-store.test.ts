import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import { createCartDraftStore, retireCartDraft } from "../../../apps/pos-web/src/local/cart-draft-store";
import { deletePosLocalDatabase, openPosLocalDatabase } from "../../../apps/pos-web/src/local/pos-local-db";
import type { CartDraft } from "../../../docs/contracts/domain.generated";

const DBS: string[] = [];

function uniqueDb() {
  const name = `cetech-pos-local-${crypto.randomUUID()}`;
  DBS.push(name);
  return openPosLocalDatabase(name);
}

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

function draft(overrides: Partial<CartDraft> = {}): CartDraft {
  return {
    cartId: "11111111-1111-4111-8111-111111111111",
    revision: 1,
    customer: { kind: "walkin" },
    locationId: "loc_a1",
    lines: [
      {
        lineId: "22222222-2222-4222-8222-222222222222",
        productId: "item-0000001",
        variationId: "item-0000006",
        quantity: "1.5",
      },
    ],
    updatedAt: "2026-09-13T20:00:00.000Z",
    ...overrides,
  };
}

describe("CORE-04 CartDraftStore", () => {
  test("saves and restores after close/reopen", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    const store = createCartDraftStore(db);
    await store.save(draft({ revision: 4 }));
    db.close();
    const reopened = openPosLocalDatabase(name);
    const restored = await createCartDraftStore(reopened).load(draft().cartId);
    expect(restored?.revision).toBe(4);
    expect(restored?.lines[0]?.quantity).toBe("1.5");
    expect(restored?.lines[0]?.variationId).toBe("item-0000006");
  });

  test("monotonic revision does not let an older save overwrite a newer draft", async () => {
    const store = createCartDraftStore(uniqueDb());
    await store.save(draft({ revision: 5, updatedAt: "2026-09-13T20:01:00.000Z" }));
    await store.save(draft({ revision: 4, customer: { kind: "retail", customerId: "cust-1" } }));
    const loaded = await store.load(draft().cartId);
    expect(loaded?.revision).toBe(5);
    expect(loaded?.customer).toEqual({ kind: "walkin" });
  });

  test("retires only the exact cart draft and leaves other local drafts untouched", async () => {
    const db = uniqueDb();
    const store = createCartDraftStore(db);
    const first = draft({ cartId: "11111111-1111-4111-8111-111111111111" });
    const second = draft({
      cartId: "33333333-3333-4333-8333-333333333333",
      revision: 2,
      updatedAt: "2026-09-13T20:03:00.000Z",
    });
    await store.save(first);
    await store.save(second);

    await retireCartDraft(first.cartId, db);

    expect(await store.load(first.cartId)).toBeNull();
    expect(await store.load(second.cartId)).toMatchObject({ revision: 2 });
    expect(await db.cartDrafts.count()).toBe(1);
  });

  test("customer switch and new-sale reset persist distinct carts", async () => {
    const store = createCartDraftStore(uniqueDb());
    await store.save(
      draft({
        revision: 2,
        customer: { kind: "b2b", customerId: "cust-synthetic-1" },
      }),
    );
    const newSale = draft({
      cartId: "33333333-3333-4333-8333-333333333333",
      revision: 0,
      customer: { kind: "walkin" },
      lines: [],
      updatedAt: "2026-09-13T20:02:00.000Z",
    });
    await store.save(newSale);
    const switched = await store.load(draft().cartId);
    const reset = await store.load(newSale.cartId);
    expect(switched?.customer).toEqual({ kind: "b2b", customerId: "cust-synthetic-1" });
    expect(reset?.revision).toBe(0);
    expect(reset?.lines).toEqual([]);
  });
});
