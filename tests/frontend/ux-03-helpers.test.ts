import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cashTenderSuggestions, ceilMinorToStep } from "../../apps/pos-web/src/features/sell/state/cashTenderSuggestions";
import { cashConfirmEnabled, evaluateCashReceived } from "../../apps/pos-web/src/features/sell/state/cashChange";
import { deriveVariableDisplayPrice, formatProductDisplayPrice } from "../../apps/pos-web/src/features/sell/state/variableDisplayPrice";
import { loadAllCatalogChildren } from "../../apps/pos-web/src/features/sell/runtime/catalogChildren";
import type { CatalogItem } from "../../docs/contracts/domain.generated";
import type { ApiResult, CatalogPort } from "../../docs/contracts/ports";
import type { CatalogPage } from "../../docs/contracts/domain.generated";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function money(minor: number, currency = "GHS") {
  return { minor, currency };
}

function child(id: string, minor?: number, currency = "GHS"): CatalogItem {
  return {
    id,
    name: `Child ${id}`,
    barcodes: [],
    kind: "variation",
    parentId: "parent",
    stockStatus: "in_stock",
    projectionUpdatedAt: "2026-09-19T00:00:00.000Z",
    displayPrice: minor === undefined ? undefined : money(minor, currency),
  };
}

describe("UX-03 cash live change and tenders", () => {
  test("uses integer minor units and disables confirm until cash covers the due amount", () => {
    expect(ceilMinorToStep(137_600, 5_000)).toBe(140_000);
    expect(cashTenderSuggestions(137_600)).toEqual([138_000, 140_000]);
    expect(cashTenderSuggestions(1_500)).toEqual([2_000, 5_000]);
    expect(cashTenderSuggestions(10_000)).toEqual([11_000, 15_000]);
    expect(new Set(cashTenderSuggestions(1_376_00)).size).toBe(cashTenderSuggestions(1_376_00).length);

    expect(evaluateCashReceived({ raw: "", dueMinor: 137_600, currency: "GHS" }).kind).toBe("empty");
    expect(evaluateCashReceived({ raw: "abc", dueMinor: 137_600, currency: "GHS" }).kind).toBe("invalid");
    expect(evaluateCashReceived({ raw: "-1", dueMinor: 137_600, currency: "GHS" }).kind).toBe("invalid");
    const under = evaluateCashReceived({ raw: "10.00", dueMinor: 137_600, currency: "GHS" });
    expect(under.kind).toBe("under");
    if (under.kind === "under") {
      expect(under.message).toBe("Cash received is less than the amount due.");
    }
    const exact = evaluateCashReceived({ raw: "1376.00", dueMinor: 137_600, currency: "GHS" });
    expect(exact).toEqual({ kind: "ready", receivedMinor: 137_600, changeDueMinor: 0 });
    const over = evaluateCashReceived({ raw: "1400.00", dueMinor: 137_600, currency: "GHS" });
    expect(over).toEqual({ kind: "ready", receivedMinor: 140_000, changeDueMinor: 2_400 });
    expect(cashConfirmEnabled(exact, { busy: false, prepared: true })).toBe(true);
    expect(cashConfirmEnabled(under, { busy: false, prepared: true })).toBe(false);
    expect(cashConfirmEnabled(exact, { busy: true, prepared: true })).toBe(false);
  });
});

describe("UX-03 variable advisory price range", () => {
  const format = (value: { minor: number; currency: string }) =>
    `${value.currency} ${(value.minor / 100).toFixed(2)}`.replace(/(\d)(?=(\d{3})+\.)/g, "$1,");

  test("A simple scalar stays a single price", () => {
    expect(deriveVariableDisplayPrice({ displayPrice: money(15_000) }, { ok: true, items: [] })).toEqual({
      kind: "single",
      amount: money(15_000),
    });
  });

  test("B differing children produce min–max", () => {
    const view = deriveVariableDisplayPrice({}, { ok: true, items: [child("a", 6_500), child("b", 56_700)] });
    expect(view).toEqual({ kind: "range", min: money(6_500), max: money(56_700) });
    expect(formatProductDisplayPrice(view, format)).toBe("GHS 65.00 – GHS 567.00");
  });

  test("C equal children collapse to one amount", () => {
    expect(deriveVariableDisplayPrice({}, { ok: true, items: [child("a", 6_500), child("b", 6_500)] })).toEqual({
      kind: "single",
      amount: money(6_500),
    });
  });

  test("D one applicable child is a single price", () => {
    expect(deriveVariableDisplayPrice({}, { ok: true, items: [child("a", 6_500)] })).toEqual({
      kind: "single",
      amount: money(6_500),
    });
  });

  test("E no priced children is unavailable", () => {
    expect(deriveVariableDisplayPrice({}, { ok: true, items: [] })).toEqual({ kind: "unavailable" });
  });

  test("F incomplete child pricing fails closed", () => {
    expect(deriveVariableDisplayPrice({}, { ok: true, items: [child("a", 6_500), child("b")] })).toEqual({
      kind: "unavailable",
    });
  });

  test("G currency mismatch fails closed", () => {
    expect(
      deriveVariableDisplayPrice({}, { ok: true, items: [child("a", 6_500, "GHS"), child("b", 7_000, "USD")] }),
    ).toEqual({ kind: "unavailable" });
  });

  test("pagination failure does not emit a partial range", () => {
    expect(deriveVariableDisplayPrice({}, { ok: false })).toEqual({ kind: "unavailable" });
  });
});

describe("UX-03 complete child pagination", () => {
  test("walks every parentId page and fails closed on a cursor loop", async () => {
    const pages = new Map<string | undefined, CatalogPage>([
      [
        undefined,
        {
          items: Array.from({ length: 50 }, (_, index) => child(`p1-${index}`, 100 + index)),
          nextCursor: "cursor-2",
        },
      ],
      [
        "cursor-2",
        {
          items: [child("p2-min", 65_00), child("p2-max", 567_00)],
        },
      ],
    ]);
    const catalog: CatalogPort = {
      async search(input): Promise<ApiResult<CatalogPage>> {
        const page = pages.get(input.cursor);
        return { ok: true, data: page ?? { items: [] }, correlationId: "00000000-0000-4000-8000-000000000001" };
      },
    };
    const loaded = await loadAllCatalogChildren(catalog, "parent");
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.items).toHaveLength(52);
      expect(loaded.items[50]?.id).toBe("p2-min");
    }

    const looping: CatalogPort = {
      async search(): Promise<ApiResult<CatalogPage>> {
        return {
          ok: true,
          data: { items: [child("loop", 1)], nextCursor: "same" },
          correlationId: "00000000-0000-4000-8000-000000000002",
        };
      },
    };
    expect(await loadAllCatalogChildren(looping, "parent")).toEqual({ ok: false });
  });
});

describe("UX-03 variable range enrichment", () => {
  test("uses every child page and does not query Woo", async () => {
    const { enrichSellProductPrices } = await import("../../apps/pos-web/src/features/sell/runtime/catalogLookup");
    let searches = 0;
    const catalog: CatalogPort = {
      async search(input): Promise<ApiResult<CatalogPage>> {
        searches += 1;
        expect(input.parentId).toBe("parent");
        if (!input.cursor) {
          return {
            ok: true,
            data: {
              items: Array.from({ length: 50 }, (_, index) => child(`p1-${index}`, 8_000)),
              nextCursor: "cursor-2",
            },
            correlationId: "00000000-0000-4000-8000-000000000003",
          };
        }
        return {
          ok: true,
          data: { items: [child("cheap", 6_500), child("dear", 56_700)] },
          correlationId: "00000000-0000-4000-8000-000000000003",
        };
      },
    };
    const views = await enrichSellProductPrices(
      catalog,
      [
        {
          id: "parent",
          name: "Variable parent",
          barcodes: [],
          kind: "variable",
          stockStatus: "in_stock",
        },
      ],
      new Map(),
    );
    expect(searches).toBe(2);
    expect(views[0]?.priceView).toEqual({
      kind: "range",
      min: money(6_500),
      max: money(56_700),
    });
  });
});

describe("UX-03 variable price cache invalidation", () => {
  const parent = {
    id: "parent",
    name: "Variable parent",
    barcodes: [] as string[],
    kind: "variable" as const,
    stockStatus: "in_stock" as const,
  };

  function catalogWithChildren(minors: Array<number | undefined>): CatalogPort {
    return {
      async search(): Promise<ApiResult<CatalogPage>> {
        return {
          ok: true,
          data: { items: minors.map((minor, index) => child(`c${index}`, minor)) },
          correlationId: "00000000-0000-4000-8000-000000000004",
        };
      },
    };
  }

  test("generation change discards a cached range after the projection rebuilds", async () => {
    const { enrichSellProductPrices } = await import("../../apps/pos-web/src/features/sell/runtime/catalogLookup");
    const { bindPriceCacheToGeneration } = await import(
      "../../apps/pos-web/src/features/sell/runtime/productDisplayPriceCache"
    );
    const { formatProductDisplayPrice } = await import(
      "../../apps/pos-web/src/features/sell/state/variableDisplayPrice"
    );
    const format = (value: { minor: number; currency: string }) =>
      `${value.currency} ${(value.minor / 100).toFixed(2)}`;
    const cache = new Map();
    const observed = { current: undefined as number | undefined };

    bindPriceCacheToGeneration(cache, observed, 1);
    const first = await enrichSellProductPrices(catalogWithChildren([6_500, 56_700]), [parent], cache);
    expect(formatProductDisplayPrice(first[0]?.priceView, format)).toBe("GHS 65.00 – GHS 567.00");

    const stale = await enrichSellProductPrices(catalogWithChildren([10_000, 20_000]), [parent], cache);
    expect(formatProductDisplayPrice(stale[0]?.priceView, format)).toBe("GHS 65.00 – GHS 567.00");

    expect(bindPriceCacheToGeneration(cache, observed, 2)).toBe(true);
    expect(cache.size).toBe(0);
    const fresh = await enrichSellProductPrices(catalogWithChildren([10_000, 20_000]), [parent], cache);
    expect(formatProductDisplayPrice(fresh[0]?.priceView, format)).toBe("GHS 100.00 – GHS 200.00");
  });

  test("generation change discards a cached Price unavailable after children become priced", async () => {
    const { enrichSellProductPrices } = await import("../../apps/pos-web/src/features/sell/runtime/catalogLookup");
    const { bindPriceCacheToGeneration } = await import(
      "../../apps/pos-web/src/features/sell/runtime/productDisplayPriceCache"
    );
    const cache = new Map();
    const observed = { current: undefined as number | undefined };
    bindPriceCacheToGeneration(cache, observed, 1);
    const unavailable = await enrichSellProductPrices(catalogWithChildren([undefined, undefined]), [parent], cache);
    expect(unavailable[0]?.priceView).toEqual({ kind: "unavailable" });

    expect(bindPriceCacheToGeneration(cache, observed, 2)).toBe(true);
    const recovered = await enrichSellProductPrices(catalogWithChildren([10_000, 20_000]), [parent], cache);
    expect(recovered[0]?.priceView).toEqual({
      kind: "range",
      min: money(10_000),
      max: money(20_000),
    });
  });
});

describe("UX-03 electronic tender fail-closed selection", () => {
  test("checks the selected tender's own availability, not any electronic method", async () => {
    const { electronicTenderAvailable } = await import(
      "../../apps/pos-web/src/features/sell/components/TenderChoice"
    );
    const mixed = { cash: true as const, mobileMoney: false, card: true, externalElectronic: false };
    expect(electronicTenderAvailable("card", mixed)).toBe(true);
    expect(electronicTenderAvailable("mobile_money", mixed)).toBe(false);
    expect(electronicTenderAvailable("external_electronic", mixed)).toBe(false);
    const source = readFileSync(resolve(repoRoot, "apps/pos-web/src/features/sell/runtime/SellRuntimeScreen.tsx"), "utf8");
    expect(source).toContain("electronicTenderAvailable(tender, tenderAvailability)");
    expect(source).not.toContain(
      "!tenderAvailability.mobileMoney && !tenderAvailability.card && !tenderAvailability.externalElectronic",
    );
  });
});

describe("UX-03 catalog projection generation wiring", () => {
  test("min-interval skip does not count as an applied projection", async () => {
    const { catalogProjectionSyncApplied } = await import("../../apps/pos-web/src/local/catalog-sync");
    expect(
      catalogProjectionSyncApplied({
        availability: "fresh",
        sourceMode: "provider",
        itemCount: 10,
        fetchedPages: 0,
        usedSyntheticSeed: false,
        producerUnavailable: false,
      }),
    ).toBe(false);
    expect(
      catalogProjectionSyncApplied({
        availability: "fresh",
        sourceMode: "provider",
        itemCount: 10,
        fetchedPages: 2,
        usedSyntheticSeed: false,
        producerUnavailable: false,
      }),
    ).toBe(true);
    expect(
      catalogProjectionSyncApplied({
        availability: "fresh",
        sourceMode: "synthetic",
        itemCount: 4,
        fetchedPages: 0,
        usedSyntheticSeed: true,
        producerUnavailable: true,
      }),
    ).toBe(true);
  });

  test("pos-app passes catalogProjectionGeneration after applied syncs", () => {
    const source = readFileSync(resolve(repoRoot, "apps/pos-web/src/app/pos-app.tsx"), "utf8");
    expect(source).toContain("catalogProjectionGeneration");
    expect(source).toContain("catalogProjectionSyncApplied");
    expect(source).toContain("bumpCatalogProjectionGeneration");
  });
});
