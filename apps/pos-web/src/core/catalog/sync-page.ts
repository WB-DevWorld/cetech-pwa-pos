import type { CatalogSourcePolicy } from "./source-policy";
import type { CatalogSourceRecord } from "./source";

/** Provider-neutral catalog sync page returned by the POS BFF. No prices. */
export type CatalogSyncPage = {
  readonly policy: CatalogSourcePolicy;
  readonly sourceSystem: "woocommerce";
  readonly items: ReadonlyArray<CatalogSourceRecord>;
  readonly nextCursor: string | null;
};
