import type {
  BridgeCommercialRefundRequest,
  BridgeCommercialRefundState,
  BridgeStockDispositionRequest,
  BridgeStockDispositionState,
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

export function isBridgeCommercialRefundRequest(value: unknown): value is BridgeCommercialRefundRequest {
  return validateCanonicalDef("BridgeCommercialRefundRequest", value);
}

export function isBridgeCommercialRefundState(value: unknown): value is BridgeCommercialRefundState {
  return validateCanonicalDef("BridgeCommercialRefundState", value);
}

export function isBridgeStockDispositionRequest(value: unknown): value is BridgeStockDispositionRequest {
  return validateCanonicalDef("BridgeStockDispositionRequest", value);
}

export function isBridgeStockDispositionState(value: unknown): value is BridgeStockDispositionState {
  return validateCanonicalDef("BridgeStockDispositionState", value);
}
