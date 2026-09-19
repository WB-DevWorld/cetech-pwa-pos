import { describe, expect, test } from "vitest";
import type { CatalogSourceRecord } from "../../core/catalog/source";
import { stableCatalogPosItemId } from "../../core/catalog/stable-pos-id";
import type { PosRestFetch } from "../http/server-fetch";
import {
  CATALOG_IDENTITY_SELECT,
  createMemoryCatalogProjectionStore,
  createSupabaseCatalogProjectionStore,
  toCatalogProjectionPersistRow,
} from "./catalog-projection-store";
import { toCatalogProjectionRow } from "./projection-rows";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const POS_ID = stableCatalogPosItemId("woocommerce", "101");

const RECORD: CatalogSourceRecord = {
  posItemId: POS_ID,
  sourceSystem: "woocommerce",
  sourceItemId: "101",
  sourceVersion: "v1",
  name: "Simple Switch",
  sku: "0123SKU",
  barcodes: ["0012345678901"],
  kind: "simple",
  stockStatus: "in_stock",
  sourceUpdatedAt: "2026-09-18T12:00:00.000Z",
  displayPrice: { minor: 9999, currency: "GHS" },
};

describe("STG-06 catalog projection persist", () => {
  test("identity select list never includes price columns", () => {
    expect(CATALOG_IDENTITY_SELECT).not.toContain("display_price");
    expect(CATALOG_IDENTITY_SELECT).not.toContain("price");
  });

  test("persist rows force display prices to null even if a source record carried a display price", () => {
    const persist = toCatalogProjectionPersistRow(
      toCatalogProjectionRow("org_a", RECORD, 1, NOW.toISOString()),
    );
    expect(persist.display_price_minor).toBeNull();
    expect(persist.display_currency).toBeNull();
    expect(persist.item_id).toBe(POS_ID);
    expect(persist.source_item_id).toBe("101");
  });

  test("memory store upserts identity without exposing prices on lookup", async () => {
    const store = createMemoryCatalogProjectionStore();
    await store.upsertRecords("org_a", [RECORD], NOW);
    const rows = await store.loadByItemIds("org_a", [POS_ID]);
    expect(rows).toEqual([
      {
        itemId: POS_ID,
        sourceSystem: "woocommerce",
        sourceItemId: "101",
        tombstoned: false,
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain("9999");
    expect(JSON.stringify(rows)).not.toContain("display");
  });

  test("supabase adapter upserts without price columns in the lookup query", async () => {
    const seen: string[] = [];
    const fetchImpl: PosRestFetch = async (input, init) => {
      seen.push(`${init.method ?? "GET"} ${input}`);
      if ((init.method ?? "GET") === "POST") {
        const body = JSON.parse(String(init.body)) as Array<Record<string, unknown>>;
        expect(body[0]?.display_price_minor).toBeNull();
        expect(body[0]?.display_currency).toBeNull();
        expect(body[0]?.item_id).toBe(POS_ID);
        return { ok: true, status: 201, json: async () => null };
      }
      expect(input).toContain(`select=${CATALOG_IDENTITY_SELECT}`);
      expect(input).not.toContain("display_price");
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            organization_id: "org_a",
            item_id: POS_ID,
            source_system: "woocommerce",
            source_item_id: "101",
            tombstoned_at: null,
          },
        ],
      };
    };
    const store = createSupabaseCatalogProjectionStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "service-role-test-key",
      fetchImpl,
    });
    await store.upsertRecords("org_a", [RECORD], NOW);
    const rows = await store.loadByItemIds("org_a", [POS_ID]);
    expect(rows[0]?.sourceItemId).toBe("101");
    expect(seen.some((entry) => entry.startsWith("POST"))).toBe(true);
    expect(seen.some((entry) => entry.startsWith("GET"))).toBe(true);
  });
});
