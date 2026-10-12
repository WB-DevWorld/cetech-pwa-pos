import { describe, expect, test } from "vitest";
import {
  beginOnlineStatusRefresh,
  completeStatusRefresh,
  createStatusRefreshState,
  latestCompletedCheckTime,
  requestStatusRefresh,
  settleWithin,
  unmountStatusRefresh,
} from "./healthRefresh";

describe("status refresh gate", () => {
  test("ignores overlapping clicks and does not treat the start time as completion", () => {
    const first = requestStatusRefresh(createStatusRefreshState(), 1_000);
    expect(first.start).toBe(true);
    const storm = requestStatusRefresh(first.state, 1_100);
    expect(storm.start).toBe(false);
    expect(storm.state.generation).toBe(first.state.generation);
    expect(storm.state.lastCompletedAt).toBeUndefined();
    const completed = completeStatusRefresh(first.state, first.state.generation, "2026-10-10T06:00:00.000Z");
    expect(completed.lastCompletedAt).toBe("2026-10-10T06:00:00.000Z");
    expect(completed.inFlight).toBe(false);
  });

  test("drops a stale reply after a newer online transition and after unmount", () => {
    const started = requestStatusRefresh(createStatusRefreshState(), 1_000);
    const online = beginOnlineStatusRefresh(started.state, 2_000);
    expect(online.start).toBe(true);
    const stale = completeStatusRefresh(online.state, started.state.generation, "2026-10-10T06:00:01.000Z");
    expect(stale.lastCompletedAt).toBeUndefined();
    expect(stale.inFlight).toBe(true);
    const unmounted = unmountStatusRefresh(online.state);
    const afterUnmount = completeStatusRefresh(unmounted, online.state.generation, "2026-10-10T06:00:02.000Z");
    expect(afterUnmount.lastCompletedAt).toBeUndefined();
    expect(requestStatusRefresh(unmounted, 3_000).start).toBe(false);
  });

  test("a failed completion does not invent a checked time", () => {
    const started = requestStatusRefresh(createStatusRefreshState(), 5_000);
    const failed = completeStatusRefresh(started.state, started.state.generation, undefined);
    expect(failed.lastCompletedAt).toBeUndefined();
    expect(latestCompletedCheckTime(["not-a-date"])).toBeUndefined();
    expect(latestCompletedCheckTime(["2026-10-10T06:00:00.000Z", "2026-10-10T06:00:09.000Z"])).toBe(
      "2026-10-10T06:00:09.000Z",
    );
  });

  test("a hung read and a hung diagnostic settle on their own deadlines", async () => {
    const hung = new Promise<string>(() => undefined);
    const health = settleWithin(hung, 30, "health-timeout");
    const diagnostic = settleWithin(hung, 10, "diagnostic-timeout");
    await expect(diagnostic).resolves.toBe("diagnostic-timeout");
    await expect(health).resolves.toBe("health-timeout");
    await expect(settleWithin(Promise.reject(new Error("boom")), 20, "failed")).resolves.toBe("failed");
    await expect(settleWithin(Promise.resolve("ok"), 20, "failed")).resolves.toBe("ok");
  });
});
