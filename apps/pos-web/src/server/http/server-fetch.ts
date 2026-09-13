export type PosRestFetch = (
  input: string,
  init: {
    readonly method?: string;
    readonly headers: Record<string, string>;
    readonly body?: string;
    readonly signal?: AbortSignal;
  },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
}>;

/**
 * Server-only fetch wrapper. Do not import from browser modules.
 */
export function createServerRestFetch(): PosRestFetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json(),
    };
  };
}
