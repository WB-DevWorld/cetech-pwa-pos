import type { ApiErrorCode, ApiFailure, Uuid } from "../../../../../docs/contracts/domain.generated";

const POLICY: Record<
  Extract<ApiErrorCode, "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION_ERROR" | "INTEGRATION_UNAVAILABLE">,
  { readonly retryable: boolean; readonly nextAction: ApiFailure["error"]["nextAction"] }
> = {
  AUTH_REQUIRED: { retryable: false, nextAction: "reauthenticate" },
  FORBIDDEN: { retryable: false, nextAction: "none" },
  VALIDATION_ERROR: { retryable: false, nextAction: "none" },
  INTEGRATION_UNAVAILABLE: { retryable: true, nextAction: "resolve" },
};

export function authFailure(
  code: keyof typeof POLICY,
  message: string,
  correlationId: Uuid,
): ApiFailure {
  const policy = POLICY[code];
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: policy.retryable,
      nextAction: policy.nextAction,
    },
    correlationId,
  };
}
