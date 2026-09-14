import type { ApiErrorCode, ApiFailure, Uuid } from "../../../../../docs/contracts/domain.generated";
import errorPolicy from "../../../../../docs/contracts/error-policy.json";

type PolicyRow = {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  readonly nextAction: ApiFailure["error"]["nextAction"];
};

const POLICY = new Map<ApiErrorCode, PolicyRow>(
  (errorPolicy as readonly PolicyRow[]).map((row) => [row.code, row]),
);

export function apiFailure(
  code: ApiErrorCode,
  message: string,
  correlationId: Uuid,
  details?: NonNullable<ApiFailure["error"]["details"]>,
): ApiFailure {
  const policy = POLICY.get(code);
  if (!policy) {
    throw new Error(`missing error-policy.json row for ${code}`);
  }
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: policy.retryable,
      nextAction: policy.nextAction,
      ...(details ? { details } : {}),
    },
    correlationId,
  };
}
