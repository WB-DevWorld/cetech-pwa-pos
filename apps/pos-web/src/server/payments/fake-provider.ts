import type { Money } from "../../../../../docs/contracts/domain.generated";
import { hmacSha512Hex } from "./hmac";
import type {
  ElectronicPaymentProvider,
  ProviderInitializeInput,
  ProviderInitializeResult,
  ProviderVerifyResult,
  ProviderWebhookEvent,
} from "./provider";

export type FakeVerifyScript =
  | "success"
  | "pending"
  | "failed"
  | "cancelled"
  | "timeout"
  | "amount_mismatch"
  | "currency_mismatch"
  | "reference_mismatch"
  | "live_mode"
  | "unknown_status"
  | "envelope_only";

export type FakeElectronicPaymentProvider = ElectronicPaymentProvider & {
  initializeCount: number;
  verifyCount: number;
  webhookSecret: string;
  setInitializeOutcome(outcome: ProviderInitializeResult["kind"] | "live_mode_blocked"): void;
  setVerifyOutcome(reference: string, script: FakeVerifyScript): void;
  setDefaultVerify(script: FakeVerifyScript): void;
  sign(rawBody: string): string;
};

export function createFakeElectronicPaymentProvider(input?: {
  readonly webhookSecret?: string;
}): FakeElectronicPaymentProvider {
  const webhookSecret = input?.webhookSecret ?? "test-paystack-secret";
  const verifyByReference = new Map<string, FakeVerifyScript>();
  const amounts = new Map<string, Money>();
  let initializeOutcome: ProviderInitializeResult["kind"] = "initialized";
  let defaultVerify: FakeVerifyScript = "success";

  const provider: FakeElectronicPaymentProvider = {
    id: "paystack",
    initializeCount: 0,
    verifyCount: 0,
    webhookSecret,
    setInitializeOutcome(outcome) {
      initializeOutcome = outcome;
    },
    setVerifyOutcome(reference, script) {
      verifyByReference.set(reference, script);
    },
    setDefaultVerify(script) {
      defaultVerify = script;
    },
    sign(rawBody) {
      return hmacSha512Hex(webhookSecret, rawBody);
    },
    async initialize(request: ProviderInitializeInput): Promise<ProviderInitializeResult> {
      provider.initializeCount += 1;
      amounts.set(request.reference, request.amount);
      if (initializeOutcome === "live_mode_blocked") {
        return { kind: "live_mode_blocked" };
      }
      if (initializeOutcome === "lost_response") {
        return { kind: "lost_response" };
      }
      if (initializeOutcome === "failed") {
        return { kind: "failed", retryable: false, message: "provider initialize failed" };
      }
      return { kind: "initialized", accessCode: `acc_${request.reference}`, displayReference: request.reference };
    },
    async verify(reference: string): Promise<ProviderVerifyResult> {
      provider.verifyCount += 1;
      const script = verifyByReference.get(reference) ?? defaultVerify;
      return scriptToVerify(script, reference, amounts.get(reference) ?? { minor: 2900, currency: "GHS" });
    },
    authenticateWebhook(rawBody, signature) {
      return signature === hmacSha512Hex(webhookSecret, rawBody);
    },
    parseWebhook(rawBody) {
      try {
        const parsed = JSON.parse(rawBody) as {
          readonly event?: string;
          readonly data?: {
            readonly reference?: string;
            readonly status?: string;
            readonly id?: number | string;
            readonly domain?: string;
          };
        };
        if (!parsed.event) {
          return null;
        }
        const event: ProviderWebhookEvent = {
          eventType: parsed.event,
          reference: parsed.data?.reference,
          providerStatus: parsed.data?.status,
          providerTransactionId: parsed.data?.id !== undefined ? String(parsed.data.id) : undefined,
          domain: parsed.data?.domain === "live" || parsed.data?.domain === "test" ? parsed.data.domain : undefined,
        };
        return event;
      } catch {
        return null;
      }
    },
  };
  return provider;
}

function scriptToVerify(script: FakeVerifyScript, reference: string, amount: Money): ProviderVerifyResult {
  switch (script) {
    case "timeout":
      return { kind: "timeout" };
    case "pending":
      return { kind: "pending", domain: "test", providerStatus: "pending", amount, reference };
    case "failed":
      return { kind: "failed", domain: "test", providerStatus: "failed", amount, reference };
    case "cancelled":
      return { kind: "cancelled", domain: "test", providerStatus: "abandoned", reference };
    case "amount_mismatch":
      return {
        kind: "success",
        domain: "test",
        providerStatus: "success",
        amount: { minor: 9999, currency: "GHS" },
        currency: "GHS",
        reference,
        metadata: {},
      };
    case "currency_mismatch":
      return {
        kind: "success",
        domain: "test",
        providerStatus: "success",
        amount: { minor: 2900, currency: "USD" },
        currency: "USD",
        reference,
        metadata: {},
      };
    case "reference_mismatch":
      return {
        kind: "success",
        domain: "test",
        providerStatus: "success",
        amount,
        currency: "GHS",
        reference: `other_${reference}`,
        metadata: {},
      };
    case "live_mode":
      return {
        kind: "success",
        domain: "live",
        providerStatus: "success",
        amount,
        currency: "GHS",
        reference,
        metadata: {},
      };
    case "unknown_status":
      return { kind: "pending", domain: "test", providerStatus: "mystery_state", amount, reference };
    case "envelope_only":
      return { kind: "failed", domain: "test", providerStatus: "ongoing", amount, reference };
    case "success":
    default:
      return {
        kind: "success",
        domain: "test",
        providerStatus: "success",
        amount,
        currency: "GHS",
        reference,
        metadata: {},
      };
  }
}
