export type BarcodeBufferState = {
  readonly value: string;
  readonly lastKeyAt: number;
};

const DEFAULT_GAP_MS = 120;

export function createBarcodeBuffer(): BarcodeBufferState {
  return { value: "", lastKeyAt: 0 };
}

export function shouldCaptureBarcodeKey(target: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!target) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  if (target.isContentEditable) return false;
  return true;
}

/**
 * Keyboard-wedge buffer. Keys are concatenated as strings so leading zeroes stay intact.
 * Never coerce the buffer through Number/parseInt.
 */
export function appendBarcodeKey(
  state: BarcodeBufferState,
  key: string,
  now: number,
  gapMs = DEFAULT_GAP_MS,
): { readonly state: BarcodeBufferState; readonly barcode?: string } {
  const base = now - state.lastKeyAt > gapMs ? "" : state.value;
  if (key === "Enter") {
    return {
      state: { value: "", lastKeyAt: now },
      barcode: base.length > 0 ? base : undefined,
    };
  }
  if (key.length !== 1) {
    return { state };
  }
  return { state: { value: `${base}${key}`, lastKeyAt: now } };
}
