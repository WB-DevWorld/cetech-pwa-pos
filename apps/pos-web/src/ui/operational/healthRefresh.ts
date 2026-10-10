export type StatusRefreshState = {
  readonly generation: number;
  readonly inFlight: boolean;
  readonly mounted: boolean;
  readonly lastStartedAtMs?: number;
  readonly lastCompletedAt?: string;
};

export function createStatusRefreshState(): StatusRefreshState {
  return { generation: 0, inFlight: false, mounted: true };
}

export function requestStatusRefresh(
  state: StatusRefreshState,
  nowMs: number,
  minIntervalMs = 1_000,
): { readonly state: StatusRefreshState; readonly start: boolean } {
  if (!state.mounted || state.inFlight) return { state, start: false };
  if (state.lastStartedAtMs !== undefined && nowMs - state.lastStartedAtMs < minIntervalMs) {
    return { state, start: false };
  }
  return {
    state: {
      ...state,
      generation: state.generation + 1,
      inFlight: true,
      lastStartedAtMs: nowMs,
    },
    start: true,
  };
}

/** Online changes supersede an in-flight check so an older reply cannot win. */
export function beginOnlineStatusRefresh(
  state: StatusRefreshState,
  nowMs: number,
): { readonly state: StatusRefreshState; readonly start: boolean } {
  if (!state.mounted) return { state, start: false };
  return {
    state: {
      ...state,
      generation: state.generation + 1,
      inFlight: true,
      lastStartedAtMs: nowMs,
    },
    start: true,
  };
}

export function completeStatusRefresh(
  state: StatusRefreshState,
  generation: number,
  completedAt: string | undefined,
): StatusRefreshState {
  if (!state.mounted || generation !== state.generation) return state;
  return {
    ...state,
    inFlight: false,
    lastCompletedAt: completedAt ?? state.lastCompletedAt,
  };
}

export function unmountStatusRefresh(state: StatusRefreshState): StatusRefreshState {
  return { ...state, mounted: false };
}

export function latestCompletedCheckTime(checkedAt: readonly string[]): string | undefined {
  const valid = checkedAt.filter((value) => Number.isFinite(Date.parse(value)));
  if (valid.length === 0) return undefined;
  return valid.slice().sort()[valid.length - 1];
}
