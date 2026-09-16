import type { Uuid } from "../../../../../docs/contracts/domain.generated";

/** Stable provider reference. Generated once from the local payment id. Contains no PII. */
export function providerReferenceFor(paymentId: Uuid): string {
  return `pos_${paymentId.replaceAll("-", "")}`;
}
