import type { Money } from "../../../../../docs/contracts/domain.generated";

export type ProviderRefundCreateInput = {
  readonly refundId: string;
  readonly paymentId: string;
  readonly providerTransactionId?: string;
  readonly amount: Money;
  readonly currency: string;
};

export type ProviderRefundCreateResult =
  | { readonly kind: "pending"; readonly providerRefundReference?: string }
  | { readonly kind: "completed"; readonly providerRefundReference: string; readonly providerTransactionId?: string }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "requires_attention"; readonly message: string }
  | { readonly kind: "lost_response" }
  | { readonly kind: "timeout" }
  | { readonly kind: "unavailable"; readonly retryable: boolean; readonly message: string };

export type ProviderRefundResolveResult =
  | {
      readonly kind: "pending";
      readonly providerRefundReference?: string;
      readonly amount?: Money;
      readonly currency?: string;
      readonly providerTransactionId?: string;
    }
  | {
      readonly kind: "completed";
      readonly providerRefundReference: string;
      readonly amount: Money;
      readonly currency: string;
      readonly providerTransactionId?: string;
      readonly domain?: "test" | "live";
    }
  | { readonly kind: "failed"; readonly message: string }
  | { readonly kind: "requires_attention"; readonly message: string }
  | { readonly kind: "not_found" }
  | { readonly kind: "timeout" }
  | { readonly kind: "unavailable"; readonly retryable: boolean; readonly message: string };

export interface ElectronicRefundProvider {
  readonly id: string;
  createRefund(input: ProviderRefundCreateInput): Promise<ProviderRefundCreateResult>;
  resolveRefund(input: {
    readonly refundId: string;
    readonly providerRefundReference?: string;
  }): Promise<ProviderRefundResolveResult>;
}
