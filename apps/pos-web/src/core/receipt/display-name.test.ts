import { describe, expect, test } from "vitest";
import { formatReceiptDisplayName, RECEIPT_DISPLAY_NAME_ELLIPSIS } from "./display-name";
import { DEFAULT_RECEIPT_SETTINGS } from "./settings";

const LONG_NAME = "Armoured Cable 4-Core 25mm Copper Conductor";

describe("formatReceiptDisplayName", () => {
  test("shortening disabled preserves the full product name", () => {
    const fullName = LONG_NAME;
    expect(
      formatReceiptDisplayName(fullName, {
        ...DEFAULT_RECEIPT_SETTINGS,
        shortenProductNames: false,
        productNameMaxCharacters: 12,
      }),
    ).toBe(fullName);
    expect(fullName).toBe(LONG_NAME);
  });

  test("short name under the limit is unchanged", () => {
    expect(
      formatReceiptDisplayName("Hardener", {
        ...DEFAULT_RECEIPT_SETTINGS,
        shortenProductNames: true,
        productNameMaxCharacters: 40,
      }),
    ).toBe("Hardener");
  });

  test("exact-limit name is unchanged", () => {
    const exact = "1234567890";
    expect(
      formatReceiptDisplayName(exact, {
        ...DEFAULT_RECEIPT_SETTINGS,
        shortenProductNames: true,
        productNameMaxCharacters: 10,
      }),
    ).toBe(exact);
  });

  test("over-limit name is shortened with one Unicode ellipsis within maxCharacters", () => {
    const displayed = formatReceiptDisplayName(LONG_NAME, {
      ...DEFAULT_RECEIPT_SETTINGS,
      shortenProductNames: true,
      productNameMaxCharacters: 18,
    });
    expect(displayed).toBe(`Armoured Cable 4-${RECEIPT_DISPLAY_NAME_ELLIPSIS}`);
    expect(displayed.includes("...")).toBe(false);
    expect(displayed.includes(RECEIPT_DISPLAY_NAME_ELLIPSIS)).toBe(true);
    expect(Array.from(displayed)).toHaveLength(18);
    expect(LONG_NAME.startsWith("Armoured Cable 4-Core")).toBe(true);
  });

  test("maxCharacters of 1 yields only the ellipsis", () => {
    const displayed = formatReceiptDisplayName(LONG_NAME, {
      ...DEFAULT_RECEIPT_SETTINGS,
      shortenProductNames: true,
      productNameMaxCharacters: 1,
    });
    expect(displayed).toBe(RECEIPT_DISPLAY_NAME_ELLIPSIS);
    expect(Array.from(displayed)).toHaveLength(1);
  });
});
