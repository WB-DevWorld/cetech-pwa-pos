import type { CustomerPort } from "../../../../docs/contracts/ports";
import type { CustomerSummary, Uuid } from "../../../../docs/contracts/domain.generated";
import { normalizeSearchText } from "../core/catalog/normalize";
import { openPosLocalDatabase, type PosLocalDatabase } from "./pos-local-db";

export type LocalCustomerRecord = CustomerSummary & { readonly searchNormalized: string };

export async function replaceLocalCustomers(
  customers: ReadonlyArray<CustomerSummary>,
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<void> {
  const rows: LocalCustomerRecord[] = customers.map((customer) => ({
    ...customer,
    searchNormalized: normalizeSearchText(customer.displayName, customer.company, customer.phoneMasked),
  }));
  await db.transaction("rw", db.customers, async () => {
    await db.customers.clear();
    if (rows.length > 0) {
      await db.customers.bulkPut(rows);
    }
  });
}

export function createLocalCustomerPort(
  options: {
    readonly db?: PosLocalDatabase;
    readonly correlationId?: () => Uuid;
  } = {},
): CustomerPort {
  const db = options.db ?? openPosLocalDatabase();
  const correlationId = options.correlationId ?? (() => crypto.randomUUID());
  return {
    async search(query: string) {
      const needle = normalizeSearchText(query);
      const rows = await db.customers.toArray();
      const data = needle
        ? rows.filter((row) => row.searchNormalized.includes(needle))
        : rows;
      return {
        ok: true,
        data: data.map((row) => {
          const { searchNormalized, ...customer } = row;
          void searchNormalized;
          return customer;
        }),
        correlationId: correlationId(),
      };
    },
  };
}
