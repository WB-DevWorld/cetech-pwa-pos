import type { ElectronicTender } from "../../../../../docs/contracts/domain.generated";
import { isPaystackTestSecret } from "./config";
import { paystackSignatureValid } from "./hmac";
import type {
  ElectronicPaymentProvider,
  ProviderInitializeInput,
  ProviderInitializeResult,
  ProviderVerifyResult,
  ProviderWebhookEvent,
} from "./provider";

export type PaystackFetch = (
  input: string,
  init: {
    readonly method: string;
    readonly headers: Record<string, string>;
    readonly body?: string;
    readonly signal?: AbortSignal;
  },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly json: () => Promise<unknown>;
}>;

export type PaystackElectronicPaymentProviderOptions = {
  readonly secretKey: string;
  readonly fetchImpl?: PaystackFetch;
  readonly timeoutMs?: number;
  readonly baseUrl?: string;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_BASE_URL = "https://api.paystack.co";

export function createPaystackElectronicPaymentProvider(
  options: PaystackElectronicPaymentProviderOptions,
): ElectronicPaymentProvider {
  if (!isPaystackTestSecret(options.secretKey)) {
    return refusedPaystackProvider();
  }

  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as PaystackFetch);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const headers = {
    Authorization: `Bearer ${options.secretKey}`,
    "Content-Type": "application/json",
  };

  return {
    id: "paystack",
    async initialize(input: ProviderInitializeInput): Promise<ProviderInitializeResult> {
      try {
        const response = await fetchImpl(`${baseUrl}/transaction/initialize`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            amount: input.amount.minor,
            email: input.email,
            reference: input.reference,
            currency: input.amount.currency,
            channels: channelsFor(input.tender),
            metadata: {
              transactionId: input.metadata.transactionId,
              paymentId: input.metadata.paymentId,
              saleId: input.metadata.saleId,
              organizationId: input.metadata.organizationId,
              locationId: input.metadata.locationId,
            },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status >= 500 || response.status === 429) {
          return { kind: "failed", retryable: true, message: "provider initialize is retryable" };
        }
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          return { kind: "lost_response" };
        }
        const data = record(record(body).data);
        const accessCode = stringValue(data.access_code);
        const reference = stringValue(data.reference) ?? input.reference;
        if (!response.ok || record(body).status !== true || !accessCode) {
          return { kind: "failed", retryable: false, message: "provider initialize was rejected" };
        }
        return { kind: "initialized", accessCode, displayReference: reference };
      } catch (error) {
        if (isTimeout(error)) {
          return { kind: "lost_response" };
        }
        return { kind: "lost_response" };
      }
    },

    async verify(reference: string): Promise<ProviderVerifyResult> {
      try {
        const response = await fetchImpl(`${baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
          method: "GET",
          headers,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status === 429 || response.status >= 500) {
          return { kind: "unavailable", retryable: true, message: "provider verification is retryable" };
        }
        let body: unknown = null;
        try {
          body = await response.json();
        } catch {
          return { kind: "unavailable", retryable: true, message: "provider verification response was unreadable" };
        }
        const envelope = record(body);
        const data = record(envelope.data);
        const providerStatus = stringValue(data.status) ?? "unknown";
        const domain = domainOf(data.domain);
        const amountMinor = numberValue(data.amount);
        const currency = stringValue(data.currency);
        const verifiedReference = stringValue(data.reference) ?? reference;
        const providerTransactionId =
          stringValue(data.id) ?? (typeof data.id === "number" ? String(data.id) : undefined);
        const metadata = stringRecord(data.metadata);
        const amount =
          amountMinor !== undefined && currency
            ? { minor: amountMinor, currency }
            : undefined;
        if (providerStatus === "success") {
          if (amountMinor === undefined || !currency) {
            return { kind: "unavailable", retryable: false, message: "provider success lacked amount or currency" };
          }
          return {
            kind: "success",
            domain: domain ?? "live",
            providerStatus,
            amount: { minor: amountMinor, currency },
            currency,
            reference: verifiedReference,
            providerTransactionId,
            metadata,
          };
        }
        if (isPendingStatus(providerStatus)) {
          return {
            kind: "pending",
            domain,
            providerStatus,
            amount,
            reference: verifiedReference,
          };
        }
        if (providerStatus === "abandoned" || providerStatus === "cancelled") {
          return { kind: "cancelled", domain, providerStatus, reference: verifiedReference };
        }
        if (providerStatus === "failed") {
          return { kind: "failed", domain, providerStatus, amount, reference: verifiedReference };
        }
        return {
          kind: "pending",
          domain,
          providerStatus: providerStatus || "unknown",
          amount,
          reference: verifiedReference,
        };
      } catch (error) {
        if (isTimeout(error)) {
          return { kind: "timeout" };
        }
        return { kind: "unavailable", retryable: true, message: "provider verification network failure" };
      }
    },

    authenticateWebhook(rawBody, signature) {
      return paystackSignatureValid(rawBody, signature, options.secretKey);
    },

    parseWebhook(rawBody) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody) as unknown;
      } catch {
        return null;
      }
      const envelope = record(parsed);
      const data = record(envelope.data);
      const eventType = stringValue(envelope.event);
      if (!eventType) {
        return null;
      }
      const event: ProviderWebhookEvent = {
        eventType,
        reference: stringValue(data.reference),
        providerTransactionId:
          stringValue(data.id) ?? (typeof data.id === "number" ? String(data.id) : undefined),
        providerStatus: stringValue(data.status),
        domain: domainOf(data.domain),
      };
      return event;
    },
  };
}

function channelsFor(tender: ElectronicTender): readonly string[] | undefined {
  if (tender === "card") {
    return ["card"];
  }
  if (tender === "mobile_money") {
    return ["mobile_money"];
  }
  return undefined;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringRecord(value: unknown): Readonly<Record<string, string>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") {
      out[key] = entry;
    }
  }
  return out;
}

function domainOf(value: unknown): "test" | "live" | undefined {
  return value === "test" || value === "live" ? value : undefined;
}

function isPendingStatus(status: string): boolean {
  return status === "pending" || status === "ongoing" || status === "processing" || status === "queued";
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || /timeout/i.test(error.message));
}

function refusedPaystackProvider(): ElectronicPaymentProvider {
  return {
    id: "paystack",
    async initialize() {
      return { kind: "live_mode_blocked" };
    },
    async verify() {
      return { kind: "unavailable", retryable: false, message: "Paystack operations require a test secret" };
    },
    authenticateWebhook() {
      return false;
    },
    parseWebhook() {
      return null;
    },
  };
}
