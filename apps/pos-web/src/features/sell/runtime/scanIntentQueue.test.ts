import { describe, expect, it, vi } from "vitest";
import { createScanIntentQueue, type ScanIntent, type ScanIntentStatus } from "./scanIntentQueue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function fixture() {
  const requests: { barcode: string; result: ReturnType<typeof deferred<string>> }[] = [];
  const applied: { intent: ScanIntent; result: string }[] = [];
  let status: ScanIntentStatus = { pendingCount: 0, failed: null };
  const queue = createScanIntentQueue({
    lookup: (barcode: string) => {
      const result = deferred<string>();
      requests.push({ barcode, result });
      return result.promise;
    },
    apply: (intent, result) => applied.push({ intent, result }),
    onChange: (next) => { status = next; },
  });
  queue.start();
  queue.setContext("cart-1", false);
  return { queue, requests, applied, status: () => status };
}

describe("scanner intent queue", () => {
  it("retains independent and repeated scans in FIFO order, with one lookup until commit acknowledgement", async () => {
    const f = fixture();
    expect(f.queue.enqueue("1111", "cart-1")).toBe(true);
    f.queue.enqueue("2222", "cart-1");
    f.queue.enqueue("1111", "cart-1");
    expect(f.queue.hasPending()).toBe(true); // Synchronous Pay guard, before a render or lookup.
    expect(f.status().pendingCount).toBe(3);
    await settle();
    expect(f.requests.map((request) => request.barcode)).toEqual(["1111"]);
    for (const [index, barcode] of ["1111", "2222", "1111"].entries()) {
      f.requests[index]!.result.resolve(`product:${barcode}`);
      await settle();
      expect(f.applied.map((value) => value.intent.barcode)).toEqual(["1111", "2222", "1111"].slice(0, index + 1));
      expect(f.requests).toHaveLength(index + 1);
      expect(f.status().pendingCount).toBe(3 - index);
      f.queue.acknowledge(f.applied[index]!.intent.id);
      await settle();
    }
    expect(f.queue.hasPending()).toBe(false);
  });

  it("pauses after a committed collision or chooser until the cashier has decided", async () => {
    const f = fixture();
    f.queue.enqueue("collision", "cart-1");
    f.queue.enqueue("next", "cart-1");
    await settle();
    f.requests[0]!.result.resolve("chooser");
    await settle();
    f.queue.setContext("cart-1", true); // The committed notice is a modal.
    f.queue.acknowledge(f.applied[0]!.intent.id);
    await settle();
    expect(f.requests).toHaveLength(1);
    expect(f.queue.enqueue("not-accepted-in-modal", "cart-1")).toBe(false);
    f.queue.setContext("cart-1", false);
    await settle();
    expect(f.requests[1]!.barcode).toBe("next");
  });

  it("retains a result completed while paused, without applying it", async () => {
      const f = fixture();
      f.queue.enqueue("1111", "cart-1");
      await settle();
      f.queue.pause();
      f.requests[0]!.result.resolve("product");
      await settle();
      expect(f.applied).toHaveLength(0);
      expect(f.queue.hasPending()).toBe(true);
      f.queue.setContext("cart-1", false);
      expect(f.applied).toHaveLength(1);
      f.queue.acknowledge(f.applied[0]!.intent.id);
      expect(f.queue.hasPending()).toBe(false);
  });

  it("retains a rejected head, blocks later scans, and retries exactly that local lookup", async () => {
    const f = fixture();
    f.queue.enqueue("failed", "cart-1");
    f.queue.enqueue("later", "cart-1");
    await settle();
    f.requests[0]!.result.reject(new Error("IndexedDB unavailable"));
    await settle();
    expect(f.status().failed?.barcode).toBe("failed");
    expect(f.status().pendingCount).toBe(2);
    expect(f.requests).toHaveLength(1);
    expect(f.applied).toHaveLength(0);
    f.queue.retry();
    await settle();
    expect(f.requests.map((request) => request.barcode)).toEqual(["failed", "failed"]);
    f.requests[1]!.result.resolve("recovered");
    await settle();
    f.queue.acknowledge(f.applied[0]!.intent.id);
    await settle();
    expect(f.requests[2]!.barcode).toBe("later");
  });

  it("explicitly cancels only a failed head and continues the retained later intent", async () => {
    const f = fixture();
    f.queue.enqueue("failed", "cart-1");
    f.queue.enqueue("later", "cart-1");
    await settle();
    f.requests[0]!.result.reject(new Error("failed"));
    await settle();
    f.queue.cancelFailed();
    await settle();
    expect(f.status()).toEqual({ pendingCount: 1, failed: null });
    expect(f.requests.map((request) => request.barcode)).toEqual(["failed", "later"]);
  });

  it("invalidates all old-cart work only when the new cart commits, ignoring late completion and acknowledgement", async () => {
    const f = fixture();
    f.queue.enqueue("old", "cart-1");
    f.queue.enqueue("old-later", "cart-1");
    await settle();
    f.queue.pause();
    f.queue.setContext("cart-2", false);
    expect(f.queue.hasPending()).toBe(false);
    expect(f.queue.enqueue("stale-event", "cart-1")).toBe(false);
    f.queue.enqueue("new", "cart-2");
    await settle();
    f.requests[0]!.result.resolve("old-result");
    f.queue.acknowledge(1);
    f.requests[1]!.result.resolve("new-result");
    await settle();
    expect(f.applied.map((value) => value.intent.cartId)).toEqual(["cart-2"]);
    expect(f.requests.map((request) => request.barcode)).toEqual(["old", "new"]);
  });

  it("ignores completion after unmount and can restart after a Strict Mode effect rehearsal", async () => {
    const f = fixture();
    f.queue.enqueue("old", "cart-1");
    await settle();
    f.queue.stop();
    f.requests[0]!.result.resolve("late");
    await settle();
    expect(f.applied).toHaveLength(0);
    expect(f.queue.enqueue("unmounted", "cart-1")).toBe(false);
    f.queue.start();
    f.queue.setContext("cart-1", false);
    f.queue.enqueue("fresh", "cart-1");
    await settle();
    f.requests[1]!.result.resolve("fresh");
    await settle();
    expect(f.applied.map((value) => value.intent.barcode)).toEqual(["fresh"]);
  });

  it("handles a synchronous lookup exception as a retryable failure without escaping the event", async () => {
    const onChange = vi.fn();
    const queue = createScanIntentQueue({ lookup: () => { throw new Error("closed database"); }, apply: vi.fn(), onChange });
    queue.start();
    queue.setContext("cart", false);
    expect(() => queue.enqueue("1111", "cart")).not.toThrow();
    await settle();
    expect(onChange.mock.lastCall?.[0].failed.barcode).toBe("1111");
  });
});
