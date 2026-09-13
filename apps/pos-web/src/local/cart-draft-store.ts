import type { CartDraftStore } from "../../../../docs/contracts/ports";
import type { CartDraft, Uuid } from "../../../../docs/contracts/domain.generated";
import { openPosLocalDatabase, type PosLocalDatabase } from "./pos-local-db";

export function createCartDraftStore(db: PosLocalDatabase = openPosLocalDatabase()): CartDraftStore {
  return {
    async save(input: CartDraft): Promise<void> {
      await db.transaction("rw", db.cartDrafts, async () => {
        const existing = await db.cartDrafts.get(input.cartId);
        if (existing && existing.revision > input.revision) {
          return;
        }
        await db.cartDrafts.put(input);
      });
    },
    async load(cartId: Uuid): Promise<CartDraft | null> {
      const row = await db.cartDrafts.get(cartId);
      return row ?? null;
    },
  };
}

export async function resetCartDraft(
  store: CartDraftStore,
  next: CartDraft,
): Promise<void> {
  await store.save(next);
}
