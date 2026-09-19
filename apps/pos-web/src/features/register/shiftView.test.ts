import { describe, expect, test } from "vitest";
import { shouldAnnounceRegisterOpened } from "./shiftView";

describe("shouldAnnounceRegisterOpened", () => {
  test("announces only after an in-flight open succeeds", () => {
    expect(shouldAnnounceRegisterOpened("opening", "open")).toBe(true);
  });

  test("does not announce restored or already-open shifts", () => {
    expect(shouldAnnounceRegisterOpened("no_open_shift", "open")).toBe(false);
    expect(shouldAnnounceRegisterOpened("open", "open")).toBe(false);
    expect(shouldAnnounceRegisterOpened("closed", "open")).toBe(false);
  });
});
