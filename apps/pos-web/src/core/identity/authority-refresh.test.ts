import { describe, expect, test } from "vitest";
import { createBurstRefresh } from "./authority-refresh";

describe("CAN-05 authority refresh burst", () => {
  test("ten immediate signals start one refresh", async () => {
    const queued: Array<() => void> = [];
    let runs = 0;
    let active = 0;
    let maxActive = 0;
    const burst = createBurstRefresh(
      async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        runs += 1;
        active -= 1;
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
    queued.shift()?.();
    await flush();
    expect(runs).toBe(1);
    expect(maxActive).toBe(1);
    expect(queued).toHaveLength(0);
  });

  test("staggered signals during one slow refresh leave exactly one trailing run", async () => {
    const queued: Array<() => void> = [];
    let runs = 0;
    let active = 0;
    let maxActive = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const burst = createBurstRefresh(
      async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        runs += 1;
        if (runs === 1) {
          await gate;
        }
        active -= 1;
      },
      {
        delayMs: 50,
        schedule(callback) {
          queued.push(callback);
        },
      },
    );

    burst.schedule();
    expect(queued).toHaveLength(1);
    queued.shift()?.();
    await Promise.resolve();
    expect(runs).toBe(1);
    expect(queued).toHaveLength(0);

    burst.schedule();
    expect(queued).toHaveLength(0);
    expect(runs).toBe(1);

    burst.schedule();
    expect(queued).toHaveLength(0);
    burst.schedule();
    expect(queued).toHaveLength(0);
    expect(runs).toBe(1);
    expect(maxActive).toBe(1);

    release();
    await flush();
    expect(runs).toBe(2);
    expect(queued).toHaveLength(0);
    expect(maxActive).toBe(1);
    await flush();
    expect(runs).toBe(2);
  });

  test("cancel drops a pending window and does not start the trailing run", async () => {
    const queued: Array<() => void> = [];
    let runs = 0;
    const pending = createBurstRefresh(
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
    pending.schedule();
    pending.schedule();
    pending.cancel();
    queued.shift()?.();
    await flush();
    expect(runs).toBe(0);

    const inflightQueued: Array<() => void> = [];
    let inflightRuns = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const inflight = createBurstRefresh(
      async () => {
        inflightRuns += 1;
        if (inflightRuns === 1) {
          await gate;
        }
      },
      {
        delayMs: 50,
        schedule(callback) {
          inflightQueued.push(callback);
        },
      },
    );
    inflight.schedule();
    inflightQueued.shift()?.();
    await Promise.resolve();
    expect(inflightRuns).toBe(1);
    inflight.schedule();
    inflight.schedule();
    expect(inflightQueued).toHaveLength(0);
    inflight.cancel();
    release();
    await flush();
    expect(inflightRuns).toBe(1);
    expect(inflightQueued).toHaveLength(0);
  });
});

async function flush(): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    await Promise.resolve();
  }
}
