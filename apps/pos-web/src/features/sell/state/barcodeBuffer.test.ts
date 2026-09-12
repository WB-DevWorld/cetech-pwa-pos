import { describe, expect, test } from "vitest";
import { appendBarcodeKey, createBarcodeBuffer, shouldCaptureBarcodeKey } from "./barcodeBuffer";

describe("FE-03 barcode buffer", () => {
  test("preserves leading zeroes as a string", () => {
    let buffer = createBarcodeBuffer();
    const now = 1_000;
    for (const key of ["0", "0", "1", "2", "3", "4", "5"]) {
      buffer = appendBarcodeKey(buffer, key, now).state;
    }
    const emitted = appendBarcodeKey(buffer, "Enter", now);
    expect(emitted.barcode).toBe("0012345");
    expect(emitted.barcode).not.toBe("12345");
  });

  test("resets after the inter-key gap instead of concatenating stale keys", () => {
    let buffer = createBarcodeBuffer();
    buffer = appendBarcodeKey(buffer, "9", 100).state;
    const next = appendBarcodeKey(buffer, "1", 400);
    expect(next.state.value).toBe("1");
  });

  test("does not capture keys typed into inputs", () => {
    expect(shouldCaptureBarcodeKey({ tagName: "INPUT" })).toBe(false);
    expect(shouldCaptureBarcodeKey({ tagName: "TEXTAREA" })).toBe(false);
    expect(shouldCaptureBarcodeKey({ tagName: "DIV" })).toBe(true);
  });
});
