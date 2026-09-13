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
