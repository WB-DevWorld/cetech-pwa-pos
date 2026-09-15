import type {
  ReturnExecuteRequest,
  ReturnPreviewRequest,
  ReturnResolution,
} from "../../../../../docs/contracts/domain.generated";
import { validateCanonicalDef } from "../quotes/canonical-schema";

export function isReturnPreviewRequest(value: unknown): value is ReturnPreviewRequest {
  return validateCanonicalDef("ReturnPreviewRequest", value);
}

export function isReturnExecuteRequest(value: unknown): value is ReturnExecuteRequest {
  return validateCanonicalDef("ReturnExecuteRequest", value);
}

export function isReturnResolution(value: unknown): value is ReturnResolution {
  return validateCanonicalDef("ReturnResolution", value);
}
