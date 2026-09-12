import { describe, expect, test } from "vitest";
import { parseDecimalToMinorUnits } from "./parseDecimalToMinorUnits";

describe("parseDecimalToMinorUnits", () => {
  test("converts cashier decimal input to integer minor units without floating-point math", () => {
    expect(parseDecimalToMinorUnits("500.00")).toEqual({ ok: true, minor: 50000 });
    expect(parseDecimalToMinorUnits("0.25")).toEqual({ ok: true, minor: 25 });
    expect(parseDecimalToMinorUnits("12")).toEqual({ ok: true, minor: 1200 });
  });

  test("rejects invalid or empty amounts", () => {
    expect(parseDecimalToMinorUnits("").ok).toBe(false);
    expect(parseDecimalToMinorUnits("abc").ok).toBe(false);
    expect(parseDecimalToMinorUnits("-1").ok).toBe(false);
    expect(parseDecimalToMinorUnits("1.234").ok).toBe(false);
  });
});
