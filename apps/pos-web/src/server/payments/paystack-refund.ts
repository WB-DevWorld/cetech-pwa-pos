import type {
  ElectronicRefundProvider,
  ProviderRefundCreateResult,
  ProviderRefundResolveResult,
} from "./refund-provider";

const CLOSED_MESSAGE =
  "Paystack refund execution is fail-closed: no client-controlled refund idempotency and no approved sandbox credentials";

/**
 * Concrete Paystack refund adapter. Never POSTs a refund.
 * Ambiguous-create recovery cannot be proven without a provider replay key.
 */
export function createPaystackElectronicRefundProvider(): ElectronicRefundProvider {
  return {
    id: "paystack",
    async createRefund(): Promise<ProviderRefundCreateResult> {
      return { kind: "requires_attention", message: CLOSED_MESSAGE };
    },
    async resolveRefund(): Promise<ProviderRefundResolveResult> {
      return { kind: "requires_attention", message: CLOSED_MESSAGE };
    },
  };
}
