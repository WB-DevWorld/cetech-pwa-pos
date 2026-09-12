import { describe, expect, test } from "vitest";
import { addQuantity, decrementQuantity, incrementQuantity, parseQuantityInput } from "./quantity";

describe("FE-03 quantity helpers", () => {
  test("adds decimal strings with scaled integer math, not floats", () => {
    expect(addQuantity("1", "1")).toEqual({ ok: true, quantity: "2" });
    expect(addQuantity("1.5", "1")).toEqual({ ok: true, quantity: "2.5" });
    expect(addQuantity("0.1", "0.2")).toEqual({ ok: true, quantity: "0.3" });
  });

  test("increments and decrements without floating-point authority", () => {
    expect(incrementQuantity("1")).toEqual({ ok: true, quantity: "2" });
    expect(decrementQuantity("2")).toEqual({ ok: true, quantity: "1" });
    expect(decrementQuantity("1").ok).toBe(false);
  });

  test("parses cashier quantity input as a decimal string", () => {
    expect(parseQuantityInput("3")).toEqual({ ok: true, quantity: "3" });
    expect(parseQuantityInput("3.50")).toEqual({ ok: true, quantity: "3.5" });
    expect(parseQuantityInput("0").ok).toBe(false);
    expect(parseQuantityInput("-1").ok).toBe(false);
    expect(parseQuantityInput("abc").ok).toBe(false);
  });

  test("rejects arithmetic that would exceed nine integer digits", () => {
    expect(addQuantity("999999998", "1")).toEqual({ ok: true, quantity: "999999999" });
    expect(addQuantity("999999999", "1").ok).toBe(false);
    expect(incrementQuantity("999999999").ok).toBe(false);
    expect(addQuantity("999999998.999999", "0.000001")).toEqual({ ok: true, quantity: "999999999" });
    expect(addQuantity("999999999.999999", "0.000001").ok).toBe(false);
  });

  test("keeps scaled-integer decimal addition inside Quantity bounds", () => {
    expect(addQuantity("1", "0.5")).toEqual({ ok: true, quantity: "1.5" });
    expect(addQuantity("3.25", "1")).toEqual({ ok: true, quantity: "4.25" });
  });
});
