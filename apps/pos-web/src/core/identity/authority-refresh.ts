/**
 * Collapses visibility/online signals into one authority refresh.
 *
 * Before a run starts, signals in the debounce window share one timer.
 * While a run is in flight, every signal sets a single trailing bit and
 * does not schedule another timer. When that run finishes, the bit starts
 * exactly one trailing run. Signals that arrived before the first run
 * finished cannot start a third run.
 *
 * This does not cache authority and does not retry mutations.
 */
export const AUTHORITY_REFRESH_BURST_MS = 50;

export function createBurstRefresh(
  run: () => Promise<void>,
  options?: {
    readonly delayMs?: number;
    readonly schedule?: (callback: () => void, delayMs: number) => void;
  },
): { schedule(): void; cancel(): void } {
  const delayMs = options?.delayMs ?? AUTHORITY_REFRESH_BURST_MS;
  const schedule = options?.schedule ?? ((callback, delay) => {
    setTimeout(callback, delay);
  });
  let timerPending = false;
  let disposed = false;
  let inflight: Promise<void> | null = null;
  let again = false;

  function kick(): void {
    if (disposed) return;
    if (inflight) {
      again = true;
      return;
    }
    inflight = Promise.resolve()
      .then(run)
      .catch(() => undefined)
      .finally(() => {
        inflight = null;
        if (again && !disposed) {
          again = false;
          kick();
        }
      });
  }

  return {
    schedule() {
      if (disposed) return;
      if (inflight) {
        again = true;
        return;
      }
      if (timerPending) return;
      timerPending = true;
      schedule(() => {
        timerPending = false;
        kick();
      }, delayMs);
    },
    cancel() {
      disposed = true;
      again = false;
    },
  };
}
