import { describe, expect, test } from "vitest";
import { formatQuoteServerTiming } from "./quote-timing";

describe("safe quote Server-Timing", () => {
  test("exposes only fixed phase names in a predictable order with rounded milliseconds", () => {
    expect(formatQuoteServerTiming(180.4, {
      saveSnapshot: 20.8, bridge: 120.2, catalogIdentity: 9.8, assignments: 10.1, session: 19.5,
    })).toBe("bff;dur=180, session;dur=20, assignments;dur=10, catalogIdentity;dur=10, bridge;dur=120, saveSnapshot;dur=21");
  });

  test("reports only entered phases and retains a real zero-duration phase", () => {
    expect(formatQuoteServerTiming(0, {})).toBe("bff;dur=0");
    expect(formatQuoteServerTiming(2, { session: 0 })).toBe("bff;dur=2, session;dur=0");
  });

  test("omits unsafe duration values rather than exposing them as header text", () => {
    const stages = {
      session: NaN, assignments: Infinity, catalogIdentity: -0.01,
      bridge: "secret\r\nX-Injected: value", saveSnapshot: Number.MAX_SAFE_INTEGER + 1,
    } as unknown as Record<string, number>;
    expect(formatQuoteServerTiming(NaN, stages)).toBe("");
    expect(formatQuoteServerTiming(-1, {})).toBe("");
    expect(formatQuoteServerTiming(Infinity, {})).toBe("");
  });

  test("does not expose unknown keys, identifiers or inherited phases", () => {
    const stages = Object.assign(Object.create({ session: 12 }), {
      assignments: 3, customerId: "private-customer", "secret\r\nX-Injected": 4,
    }) as Record<string, number>;
    expect(formatQuoteServerTiming(5, stages)).toBe("bff;dur=5, assignments;dur=3");
  });
});
