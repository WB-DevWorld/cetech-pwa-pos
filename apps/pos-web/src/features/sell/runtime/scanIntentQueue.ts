export type ScanIntent = {
  readonly id: number;
  readonly cartId: string;
  readonly barcode: string;
};

export type ScanIntentStatus = {
  readonly pendingCount: number;
  readonly failed: ScanIntent | null;
};

type Entry<Result> = {
  intent: ScanIntent;
  phase: "waiting" | "loading" | "ready" | "committing" | "failed";
  result?: Result;
};

type ScanIntentPorts<Result> = {
  lookup: (barcode: string) => Promise<Result>;
  apply: (intent: ScanIntent, result: Result) => void;
  onChange: (status: ScanIntentStatus) => void;
};

/** Transient input intent only. A result retires after its React commit, never at lookup completion. */
export function createScanIntentQueue<Result>(initialPorts?: ScanIntentPorts<Result>) {
  let ports = initialPorts;
  let entries: Entry<Result>[] = [];
  let cartId: string | null = null;
  let paused = true;
  let active = false;
  let generation = 0;
  let nextId = 0;

  function publish() {
    ports?.onChange({
      pendingCount: entries.length,
      failed: entries[0]?.phase === "failed" ? entries[0].intent : null,
    });
  }

  function current(entry: Entry<Result>, startedGeneration: number) {
    return active && generation === startedGeneration && entries[0] === entry;
  }

  function drain() {
    const head = entries[0];
    if (!active || paused || !head || !ports) return;
    if (head.phase === "ready") {
      head.phase = "committing";
      // Application schedules a pure workspace update. acknowledge() belongs to the commit effect.
      ports.apply(head.intent, head.result as Result);
      return;
    }
    if (head.phase !== "waiting") return;
    head.phase = "loading";
    const startedGeneration = generation;
    const lookup = ports.lookup;
    void Promise.resolve().then(() => current(head, startedGeneration) ? lookup(head.intent.barcode) : undefined).then(
      (result) => {
        if (!current(head, startedGeneration)) return;
        head.result = result;
        head.phase = "ready";
        drain();
      },
      () => {
        if (!current(head, startedGeneration)) return;
        head.phase = "failed";
        publish();
      },
    );
  }

  return {
    setPorts(next: ScanIntentPorts<Result>) {
      ports = next;
    },
    start() {
      active = true;
      drain();
    },
    stop() {
      active = false;
      generation += 1;
      entries = [];
      cartId = null;
      paused = true;
    },
    setContext(nextCartId: string, nextPaused: boolean) {
      if (cartId !== nextCartId) {
        generation += 1;
        entries = [];
        cartId = nextCartId;
        publish();
      }
      paused = nextPaused;
      drain();
    },
    pause() {
      paused = true;
    },
    enqueue(barcode: string, scope: string) {
      if (!active || paused || scope !== cartId) return false;
      entries.push({ intent: { id: ++nextId, cartId: scope, barcode }, phase: "waiting" });
      publish();
      drain();
      return true;
    },
    acknowledge(id: number) {
      if (entries[0]?.intent.id !== id || entries[0].phase !== "committing") return;
      entries.shift();
      publish();
      drain();
    },
    retry() {
      const head = entries[0];
      if (head?.phase !== "failed") return;
      head.phase = "waiting";
      publish();
      drain();
    },
    cancelFailed() {
      if (entries[0]?.phase !== "failed") return;
      entries.shift();
      publish();
      drain();
    },
    hasPending() {
      return entries.length > 0;
    },
    isPaused() {
      return !active || paused;
    },
  };
}
