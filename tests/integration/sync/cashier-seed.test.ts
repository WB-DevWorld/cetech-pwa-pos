import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import { createLocalCatalogPort } from "../../../apps/pos-web/src/local/catalog-repository";
import { ensureCashierLocalSeed } from "../../../apps/pos-web/src/local/cashier-seed";
import { createLocalCustomerPort } from "../../../apps/pos-web/src/local/customer-store";
import { deletePosLocalDatabase, openPosLocalDatabase } from "../../../apps/pos-web/src/local/pos-local-db";

const DBS: string[] = [];

afterEach(async () => {
  await Promise.all(DBS.splice(0).map((name) => deletePosLocalDatabase(name)));
});

describe("CORE-04 cashier synthetic seed", () => {
  test("projects leading-zero, duplicate, and variation barcodes without live inventory", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    await ensureCashierLocalSeed(db);
    await ensureCashierLocalSeed(db);
    const catalog = createLocalCatalogPort({ db, correlationId: () => "55555555-5555-4555-8555-555555555555" });
    const leading = await catalog.search({ barcode: "0012345" });
    expect(leading.ok).toBe(true);
    if (leading.ok) {
      expect(leading.data.items).toHaveLength(1);
      expect(leading.data.items[0]?.barcodes).toContain("0012345");
      expect(leading.data.items[0]?.displayPrice).toBeUndefined();
    }
    const hardener = await catalog.search({ barcode: "0012345678901" });
    expect(hardener.ok).toBe(true);
    if (hardener.ok) {
      expect(hardener.data.items[0]?.name).toBe("Epoxy Hardener 1L");
      expect(hardener.data.items[0]?.displayPrice).toEqual({ minor: 15500, currency: "GHS" });
    }
    const duplicate = await catalog.search({ barcode: "5550001112223" });
    expect(duplicate.ok).toBe(true);
    if (duplicate.ok) {
      expect(duplicate.data.items).toHaveLength(2);
    }
    const variation = await catalog.search({ barcode: "0001112223334" });
    expect(variation.ok).toBe(true);
    if (variation.ok) {
      expect(variation.data.items[0]?.kind).toBe("variation");
      expect(variation.data.items[0]?.parentId).toBe("p-cable");
    }
    const customers = createLocalCustomerPort({ db, correlationId: () => "55555555-5555-4555-8555-555555555555" });
    const found = await customers.search("Buildworks");
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.data[0]?.id).toBe("cust-buildworks");
    }
  });

  test("does not seed synthetic catalog when provider projection is required", async () => {
    const name = `cetech-pos-local-${crypto.randomUUID()}`;
    DBS.push(name);
    const db = openPosLocalDatabase(name);
    await ensureCashierLocalSeed(db, { policy: "provider_required" });
    expect(await db.catalogItems.count()).toBe(0);
  });
});
