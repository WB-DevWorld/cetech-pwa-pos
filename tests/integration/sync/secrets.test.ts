import { describe, expect, test } from "vitest";
import { journalPayloadContainsSecrets } from "../../../apps/pos-web/src/local/secrets-guard";
import { toCatalogProjectionRow } from "../../../apps/pos-web/src/server/catalog/projection-rows";
import { createSyntheticCatalogRecords } from "./fixtures/synthetic-catalog";

describe("CORE-04 secret and PII boundaries", () => {
  test("synthetic fixture has no production PII or privileged secret names", () => {
    const records = createSyntheticCatalogRecords(20);
    const blob = JSON.stringify(records);
    expect(journalPayloadContainsSecrets(blob)).toBe(false);
    expect(blob).not.toMatch(/@/);
    expect(blob.toLowerCase()).not.toContain("gmail");
    expect(records.every((record) => record.name.startsWith("Synthetic"))).toBe(true);
  });

  test("server projection rows keep barcodes as strings including leading zeroes", () => {
    const leading = createSyntheticCatalogRecords(10)[0];
    expect(leading).toBeDefined();
    if (!leading) {
      return;
    }
    const row = toCatalogProjectionRow("org_a", leading, 1, "2026-09-13T20:00:00.000Z");
    expect(row.barcodes[0]?.startsWith("0")).toBe(true);
    expect(row.stockStatus).toBe("unknown");
  });
});
