import { describe, expect, test } from "vitest";
import {
  DEFAULT_RECEIPT_SETTINGS,
  isReceiptSettings,
  RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_DEFAULT,
} from "./settings";
import { createMemoryReceiptSettingsStore } from "./settings-store";
import { validateCanonicalDef } from "../../server/quotes/canonical-schema";

describe("receipt settings", () => {
  test("defaults keep shortening and SKU off", () => {
    expect(DEFAULT_RECEIPT_SETTINGS).toEqual({
      shortenProductNames: false,
      productNameMaxCharacters: RECEIPT_PRODUCT_NAME_MAX_CHARACTERS_DEFAULT,
      showSku: false,
    });
    expect(validateCanonicalDef("ReceiptSettings", DEFAULT_RECEIPT_SETTINGS)).toBe(true);
  });

  test("rejects out-of-bounds max characters and extra properties", () => {
    expect(isReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS, productNameMaxCharacters: 0 })).toBe(false);
    expect(isReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS, productNameMaxCharacters: 257 })).toBe(false);
    expect(isReceiptSettings({ ...DEFAULT_RECEIPT_SETTINGS, extra: true })).toBe(false);
    expect(validateCanonicalDef("ReceiptSettings", { ...DEFAULT_RECEIPT_SETTINGS, productNameMaxCharacters: 0 })).toBe(
      false,
    );
  });

  test("memory store reads defaults then persists an upsert", async () => {
    const store = createMemoryReceiptSettingsStore();
    expect(await store.get("org_a", "loc_a1")).toEqual(DEFAULT_RECEIPT_SETTINGS);
    const saved = await store.upsert("org_a", "loc_a1", {
      shortenProductNames: true,
      productNameMaxCharacters: 18,
      showSku: true,
    });
    expect(saved.showSku).toBe(true);
    expect(await store.get("org_a", "loc_a1")).toEqual(saved);
    expect(await store.get("org_a", "loc_a2")).toEqual(DEFAULT_RECEIPT_SETTINGS);
  });
});
