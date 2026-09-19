import type { ApiResult, CustomerPort } from "../../../../../docs/contracts/ports";
import type { CustomerSummary } from "../../../../../docs/contracts/domain.generated";
import type { CustomerReadItem } from "./customerRead";

export function shouldReplaceLocalCustomerCacheFromSearch(): false {
  return false;
}

export function toCustomerSearchPresentation(
  items: readonly CustomerReadItem[],
): {
  readonly customers: readonly CustomerSummary[];
  readonly commercialContextById: Readonly<Record<string, string>>;
} {
  const commercialContextById: Record<string, string> = {};
  const customers = items.map((item) => {
    if (item.commercialContext) {
      commercialContextById[item.id] = item.commercialContext;
    }
    const { commercialContext, ...summary } = item;
    void commercialContext;
    return summary;
  });
  return { customers, commercialContextById };
}

export async function loadCustomerSearchPresentation(input: {
  readonly query: string;
  readonly remoteSearch: (
    query: string,
  ) => Promise<ApiResult<{ readonly items: readonly CustomerReadItem[] }>>;
  readonly localSearch: CustomerPort["search"];
}): Promise<
  | {
      readonly ok: true;
      readonly source: "remote" | "local";
      readonly customers: readonly CustomerSummary[];
      readonly commercialContextById: Readonly<Record<string, string>>;
    }
  | { readonly ok: false; readonly source: "error" }
> {
  const remote = await input.remoteSearch(input.query);
  if (remote.ok) {
    const mapped = toCustomerSearchPresentation(remote.data.items);
    return {
      ok: true,
      source: "remote",
      customers: mapped.customers,
      commercialContextById: mapped.commercialContextById,
    };
  }
  const local = await input.localSearch(input.query);
  if (!local.ok) {
    return { ok: false, source: "error" };
  }
  return {
    ok: true,
    source: "local",
    customers: local.data,
    commercialContextById: {},
  };
}
