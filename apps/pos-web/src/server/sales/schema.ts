import type {
  CashPaymentRequest,
  FinalizeSaleRequest,
  OpenShiftRequest,
  PaymentState,
  ReceiptSnapshot,
  SaleResolution,
  Shift,
} from "../../../../../docs/contracts/domain.generated";
import { validateCanonicalDef } from "../quotes/canonical-schema";

export function isCashPaymentRequest(value: unknown): value is CashPaymentRequest {
  return validateCanonicalDef("CashPaymentRequest", value);
}

export function isFinalizeSaleRequest(value: unknown): value is FinalizeSaleRequest {
  return validateCanonicalDef("FinalizeSaleRequest", value);
}

export function isOpenShiftRequest(value: unknown): value is OpenShiftRequest {
  return validateCanonicalDef("OpenShiftRequest", value);
}

export function isPaymentState(value: unknown): value is PaymentState {
  return validateCanonicalDef("PaymentState", value);
}

export function isSaleResolution(value: unknown): value is SaleResolution {
  return validateCanonicalDef("SaleResolution", value);
}

export function isReceiptSnapshot(value: unknown): value is ReceiptSnapshot {
  return validateCanonicalDef("ReceiptSnapshot", value);
}

export function isShift(value: unknown): value is Shift {
  return validateCanonicalDef("Shift", value);
}
