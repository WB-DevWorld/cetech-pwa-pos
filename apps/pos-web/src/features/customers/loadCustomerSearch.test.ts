import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { CustomerSummary } from "../../../../../docs/contracts/domain.generated";
import { createLocalCustomerPort, replaceLocalCustomers } from "../../local/customer-store";
import { deletePosLocalDatabase, openPosLocalDatabase } from "../../local/pos-local-db";
import type { CustomerReadItem } from "./customerRead";
import {
  loadCustomerSearchPresentation,
  shouldReplaceLocalCustomerCacheFromSearch,
} from "./loadCustomerSearch";

const DBS: string[] = [];
const ADA: CustomerSummary = {
  id: "cust-ada",
  kind: "retail",
  displayName: "Ada Boateng",
  phoneMasked: "024 *** 4567",
};
const KOJO: CustomerSummary = {
  id: "cust-kojo",
  kind: "b2b",
  displayName: "Kojo Stores",
  company: "Kojo Stores Ltd",
  phoneMasked: "020 *** 9876",
};

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

function remoteOk(items: readonly CustomerReadItem[]): ApiResult<{ items: readonly CustomerReadItem[] }> {
  return { ok: true, correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", data: { items } };
}

function remoteFail(): ApiResult<{ items: readonly CustomerReadItem[] }> {
  return {
    ok: false,
    correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    error: {
      code: "INTEGRATION_UNAVAILABLE",
      message: "unavailable",
      retryable: true,
      nextAction: "resolve",
    },
  };
}

describe("UX-04 customer search cache truth", () => {
  test("search results never replace the local customer cache", () => {
    expect(shouldReplaceLocalCustomerCacheFromSearch()).toBe(false);
  });

  test("searching A then B does not leave IndexedDB containing only B", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    await replaceLocalCustomers([ADA, KOJO], db);
    const port = createLocalCustomerPort({ db, correlationId: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });

    const first = await loadCustomerSearchPresentation({
      query: "Ada",
      remoteSearch: async () => remoteOk([ADA]),
      localSearch: (query: string) => port.search(query),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.customers.map((row) => row.id)).toEqual(["cust-ada"]);

    const second = await loadCustomerSearchPresentation({
      query: "Kojo",
      remoteSearch: async () => remoteOk([{ ...KOJO, commercialContext: "Trade account" }]),
      localSearch: (query: string) => port.search(query),
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.source).toBe("remote");
    expect(second.customers.map((row) => row.id)).toEqual(["cust-kojo"]);
    expect(second.commercialContextById["cust-kojo"]).toBe("Trade account");

    const cached = await port.search("");
    expect(cached.ok && cached.data.map((row) => row.id).sort()).toEqual(["cust-ada", "cust-kojo"]);
  });

  test("zero-result search does not treat a previous subset as a complete projection", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    await replaceLocalCustomers([ADA, KOJO], db);
    const port = createLocalCustomerPort({ db, correlationId: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });

    await loadCustomerSearchPresentation({
      query: "Ada",
      remoteSearch: async () => remoteOk([ADA]),
      localSearch: (query: string) => port.search(query),
    });
    const empty = await loadCustomerSearchPresentation({
      query: "zzz-no-match",
      remoteSearch: async () => remoteOk([]),
      localSearch: (query: string) => port.search(query),
    });
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.customers).toEqual([]);
    const cached = await port.search("");
    expect(cached.ok && cached.data).toHaveLength(2);
  });

  test("offline fallback uses the genuine local cache rather than a filtered remote subset", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    await replaceLocalCustomers([ADA, KOJO], db);
    const port = createLocalCustomerPort({ db, correlationId: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    const result = await loadCustomerSearchPresentation({
      query: "Kojo",
      remoteSearch: async () => remoteFail(),
      localSearch: (query: string) => port.search(query),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.source).toBe("local");
    expect(result.customers.map((row) => row.id)).toEqual(["cust-kojo"]);
  });

  test("name, company, and phone queries are passed through as producer search terms", async () => {
    const seen: string[] = [];
    const unusedLocal = async () => ({
      ok: true as const,
      data: [] as const,
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    await loadCustomerSearchPresentation({
      query: "Ada",
      remoteSearch: async (query) => {
        seen.push(query);
        return remoteOk([ADA]);
      },
      localSearch: unusedLocal,
    });
    await loadCustomerSearchPresentation({
      query: "Kojo Stores Ltd",
      remoteSearch: async (query) => {
        seen.push(query);
        return remoteOk([KOJO]);
      },
      localSearch: unusedLocal,
    });
    await loadCustomerSearchPresentation({
      query: "0241234567",
      remoteSearch: async (query) => {
        seen.push(query);
        return remoteOk([ADA]);
      },
      localSearch: unusedLocal,
    });
    expect(seen).toEqual(["Ada", "Kojo Stores Ltd", "0241234567"]);
  });
});
