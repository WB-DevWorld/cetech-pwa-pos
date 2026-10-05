const QUOTE_TIMING_STAGES = ["session", "assignments", "catalogIdentity", "bridge", "saveSnapshot"] as const;

/**
 * BFF elapsed time ends at result selection, before JSON response serialization
 * and network transfer. Only entered, allowlisted phases may leave the server.
 */
export function formatQuoteServerTiming(
  elapsedMs: number,
  stages: Readonly<Record<string, number>>,
): string {
  const metrics: string[] = [];
  function append(name: string, duration: unknown): void {
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0) return;
    const rounded = Math.round(duration);
    if (Number.isSafeInteger(rounded)) {
      metrics.push(`${name};dur=${rounded}`);
    }
  }
  append("bff", elapsedMs);
  for (const stage of QUOTE_TIMING_STAGES) {
    if (Object.hasOwn(stages, stage)) {
      append(stage, stages[stage]);
    }
  }
  return metrics.join(", ");
}
