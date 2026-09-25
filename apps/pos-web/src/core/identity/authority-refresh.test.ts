import { describe, expect, test } from "vitest";
import { createBurstRefresh } from "./authority-refresh";

describe("CAN-05 authority refresh burst", () => {
  test("ten signals in one window start one refresh", async () => {
    const queued: Array<() => void> = [];
    let runs = 0;
    const burst = createBurstRefresh(
      async () => {
        runs += 1;
      },
      {
        delayMs: 50,
        schedule(callback) {
          queued.push(callback);
        },
      },
    );
    for (let index = 0; index < 10; index += 1) {
      burst.schedule();
    }
    expect(queued).toHaveLength(1);
    expect(runs).toBe(0);
    queued[0]?.();
    await Promise.resolve();
    expect(runs).toBe(1);
  });

  test("signals during a slow refresh do not overlap and leave one trailing refresh", async () => {
    const queued: Array<() => void> = [];
    let runs = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const burst = createBurstRefresh(
      async () => {
        runs += 1;
        if (runs === 1) {
          await gate;
        }
      },
      {
        delayMs: 50,
        schedule(callback) {
          queued.push(callback);
        },
      },
    );
    burst.schedule();
    queued.shift()?.();
    await Promise.resolve();
    expect(runs).toBe(1);
    for (let index = 0; index < 10; index += 1) {
      burst.schedule();
    }
    expect(queued).toHaveLength(1);
    queued.shift()?.();
    await Promise.resolve();
    expect(runs).toBe(1);
    release();
    await flush();
    expect(runs).toBe(2);
    release();
    await flush();
    expect(runs).toBe(2);
  });
});

async function flush(): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    await Promise.resolve();
  }
}
