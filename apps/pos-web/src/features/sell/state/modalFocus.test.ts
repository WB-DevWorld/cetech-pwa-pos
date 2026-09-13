import { describe, expect, test } from "vitest";
import { nextFocusIndex } from "./modalFocus";

describe("FE-03 modal focus cycle helper", () => {
  test("tabs forward and wraps", () => {
    expect(nextFocusIndex(3, 0, false)).toBe(1);
    expect(nextFocusIndex(3, 2, false)).toBe(0);
  });

  test("shift-tabs backward and wraps", () => {
    expect(nextFocusIndex(3, 0, true)).toBe(2);
    expect(nextFocusIndex(3, 1, true)).toBe(0);
  });
});
