/**
 * Cashier presentation shortcuts only. Server confirmCash remains authoritative.
 *
 * Algorithm (deterministic, integer minor units, not a Ghana denomination policy):
 * 1. Exact equals the prepared total and is offered separately.
 * 2. Additional unique round-ups use steps of 10 / 50 / 100 major units
 *    (1000 / 5000 / 10000 minor units for two-decimal currencies).
 * 3. Values must be strictly greater than the prepared total.
 * 4. Duplicates are dropped; at most two extras are returned, smallest first.
 */
const ROUND_UP_STEPS_MINOR = [1_000, 5_000, 10_000] as const;
const MAX_EXTRA_SUGGESTIONS = 2;

export function ceilMinorToStep(minor: number, step: number): number {
  if (!Number.isInteger(minor) || minor < 0 || !Number.isInteger(step) || step <= 0) {
    return minor;
  }
  const remainder = minor % step;
  return remainder === 0 ? minor : minor + (step - remainder);
}

export function cashTenderSuggestions(totalMinor: number): readonly number[] {
  if (!Number.isInteger(totalMinor) || totalMinor < 0) {
    return [];
  }
  const extras: number[] = [];
  const seen = new Set<number>([totalMinor]);
  for (const step of ROUND_UP_STEPS_MINOR) {
    const rounded = ceilMinorToStep(totalMinor, step);
    const next = rounded === totalMinor ? totalMinor + step : rounded;
    if (next > totalMinor && !seen.has(next)) {
      seen.add(next);
      extras.push(next);
    }
    if (extras.length >= MAX_EXTRA_SUGGESTIONS) {
      break;
    }
  }
  return extras;
}
