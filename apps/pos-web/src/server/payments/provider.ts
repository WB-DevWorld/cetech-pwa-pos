import type { ElectronicTender, Money } from "../../../../../docs/contracts/domain.generated";

export type ProviderInitializeInput = {
  readonly reference: string;
  readonly amount: Money;
  readonly email: string;
  readonly tender: ElectronicTender;
  readonly metadata: {
    readonly transactionId: string;
    readonly paymentId: string;
    readonly saleId: string;
    readonly organizationId: string;
    readonly locationId: string;
  };
};

export type ProviderInitializeResult =
  | { readonly kind: "initialized"; readonly accessCode?: string; readonly displayReference: string }
  | { readonly kind: "lost_response" }
  | { readonly kind: "failed"; readonly retryable: boolean; readonly message: string }
  | { readonly kind: "live_mode_blocked" };

export type ProviderVerifyResult =
  | {
      readonly kind: "success";
      readonly domain: "test" | "live";
      readonly providerStatus: string;
      readonly amount: Money;
      readonly currency: string;
      readonly reference: string;
      readonly providerTransactionId?: string;
      readonly metadata: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: "pending";
      readonly domain?: "test" | "live";
      readonly providerStatus: string;
      readonly amount?: Money;
      readonly reference: string;
    }
  | {
      readonly kind: "failed";
      readonly domain?: "test" | "live";
      readonly providerStatus: string;
      readonly amount?: Money;
      readonly reference: string;
    }
  | {
      readonly kind: "cancelled";
      readonly domain?: "test" | "live";
      readonly providerStatus: string;
      readonly reference: string;
    }
  | { readonly kind: "timeout" }
  | { readonly kind: "unavailable"; readonly retryable: boolean; readonly message: string };

export type ProviderWebhookEvent = {
  readonly eventType: string;
  readonly reference?: string;
  readonly providerTransactionId?: string;
  readonly providerStatus?: string;
  readonly domain?: "test" | "live";
};

export interface ElectronicPaymentProvider {
  readonly id: string;
  initialize(input: ProviderInitializeInput): Promise<ProviderInitializeResult>;
  verify(reference: string): Promise<ProviderVerifyResult>;
  authenticateWebhook(rawBody: string, signature: string | null): boolean;
  parseWebhook(rawBody: string): ProviderWebhookEvent | null;
}
