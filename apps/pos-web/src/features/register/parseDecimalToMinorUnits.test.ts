import { describe, expect, test } from "vitest";
import { parseDecimalToMinorUnits } from "./parseDecimalToMinorUnits";

describe("parseDecimalToMinorUnits", () => {
  test("converts cashier decimal input to integer minor units without floating-point math", () => {
    expect(parseDecimalToMinorUnits("500.00")).toEqual({ ok: true, minor: 50000 });
    expect(parseDecimalToMinorUnits("0.25")).toEqual({ ok: true, minor: 25 });
    expect(parseDecimalToMinorUnits("12")).toEqual({ ok: true, minor: 1200 });
    expect(parseDecimalToMinorUnits("12.3")).toEqual({ ok: true, minor: 1230 });
    expect(parseDecimalToMinorUnits("0")).toEqual({ ok: true, minor: 0 });
  });

  test("rejects invalid or empty amounts", () => {
    expect(parseDecimalToMinorUnits("").ok).toBe(false);
    expect(parseDecimalToMinorUnits("abc").ok).toBe(false);
    expect(parseDecimalToMinorUnits("-1").ok).toBe(false);
    expect(parseDecimalToMinorUnits("1.234").ok).toBe(false);
    expect(parseDecimalToMinorUnits(",").ok).toBe(false);
  });

  test("rejects commas instead of silently stripping them", () => {
    expect(parseDecimalToMinorUnits("1,2").ok).toBe(false);
    expect(parseDecimalToMinorUnits("12,34").ok).toBe(false);
    expect(parseDecimalToMinorUnits("1,234").ok).toBe(false);
    expect(parseDecimalToMinorUnits("1,234.56").ok).toBe(false);
  });

  test("rejects amounts that would overflow a safe integer", () => {
    expect(parseDecimalToMinorUnits("1000000000000000").ok).toBe(false);
  });
});
