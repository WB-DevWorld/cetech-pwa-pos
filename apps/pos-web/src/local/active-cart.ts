import type { CartDraft } from "../../../../docs/contracts/domain.generated";
import { openPosLocalDatabase, type PosLocalDatabase } from "./pos-local-db";

const ACTIVE_CART_KEY = "active-cart";

/** Last Sell cart id. Not a contract change; CartDraftStore still loads by cartId. */
export async function rememberActiveCartId(
  cartId: string,
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<void> {
  await db.kv.put({ key: ACTIVE_CART_KEY, value: cartId });
}

export async function recallActiveCartId(
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<string | null> {
  const row = await db.kv.get(ACTIVE_CART_KEY);
  return row?.value ?? null;
}

export async function clearActiveCartId(db: PosLocalDatabase = openPosLocalDatabase()): Promise<void> {
  await db.kv.delete(ACTIVE_CART_KEY);
}

/**
 * Atomically replace the current persisted working cart.
 * The replacement draft, active-cart pointer, and prior-draft retirement commit
 * together so a reload can never observe a half-transitioned completed sale.
 */
export async function replaceActiveCartDraft(
  previousCartId: string,
  next: CartDraft,
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<void> {
  await db.transaction("rw", db.cartDrafts, db.kv, async () => {
    const active = await db.kv.get(ACTIVE_CART_KEY);
    if (active && active.value !== previousCartId && active.value !== next.cartId) {
      throw new Error("active cart changed during local lifecycle transition");
    }

    await db.cartDrafts.put(next);
    await db.kv.put({ key: ACTIVE_CART_KEY, value: next.cartId });
    if (previousCartId !== next.cartId) {
      await db.cartDrafts.delete(previousCartId);
    }
  });
}

