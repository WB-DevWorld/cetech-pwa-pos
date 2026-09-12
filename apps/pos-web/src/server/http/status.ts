import type { ApiErrorCode } from "../../../../../docs/contracts/domain.generated";

export function httpStatusFor(code: ApiErrorCode): number {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "AUTH_REQUIRED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "INTEGRATION_UNAVAILABLE":
      return 503;
    case "RATE_LIMITED":
      return 429;
    case "UNSUPPORTED_VERSION":
      return 426;
    case "OPERATION_IN_PROGRESS":
      return 202;
    default:
      return 409;
  }
}
