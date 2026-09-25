/**
 * Collapses a burst of visibility/online signals into one authority refresh.
 * A signal that arrives while that refresh is running schedules one trailing
 * refresh so the latest result still lands. This does not cache authority
 * and does not retry mutations.
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
      if (disposed || timerPending) return;
      timerPending = true;
      schedule(() => {
        timerPending = false;
        kick();
      }, delayMs);
    },
    cancel() {
      disposed = true;
    },
  };
}
