import type { ReleasePolicy, Uuid } from "../../../../../docs/contracts/domain.generated";
import type { ApiResult } from "../../../../../docs/contracts/ports";
import { authFailure } from "../auth/errors";
import { resolveCorrelationId } from "../http/correlation";
import { httpStatusFor } from "../http/status";

export type ReleasePolicyResponse = {
  readonly status: number;
  readonly body: ApiResult<ReleasePolicy>;
  readonly headers: { readonly "Cache-Control": "no-store"; readonly "X-Correlation-ID": Uuid };
};

/**
 * Server-owned release discovery for already-installed clients.
 * Returns the existing ReleasePolicy contract; this is not a second release truth.
 * GET has no financial effect. Auth is not required so an old build can discover
 * a newer worker without first loading that newer application bundle.
 */
export function handleReleasePolicy(input: {
  readonly correlationIdHeader?: string;
  readonly policy: ReleasePolicy;
}): ReleasePolicyResponse {
  const correlation = resolveCorrelationId(input.correlationIdHeader);
  const headers = { "Cache-Control": "no-store" as const, "X-Correlation-ID": correlation.correlationId };
  if (!correlation.ok) {
    const body = authFailure("VALIDATION_ERROR", "X-Correlation-ID must be a UUID", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }

  return {
    status: 200,
    body: {
      ok: true,
      data: input.policy,
      correlationId: correlation.correlationId,
    },
    headers,
  };
}
