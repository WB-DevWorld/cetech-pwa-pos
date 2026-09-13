/**
 * Local draft/journal stores are Dexie-owned (CORE-04). Sign-out must not clear them.
 */
export type LocalWorkStores = {
  drafts: unknown[];
  journal: unknown[];
};

export function preserveLocalWorkOnSignOut(stores: LocalWorkStores): LocalWorkStores {
  return stores;
}
