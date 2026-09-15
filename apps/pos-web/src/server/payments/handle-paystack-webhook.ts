import { apiFailure } from "../http/api-failure";
import { resolveCorrelationId } from "../http/correlation";
import type { CheckoutStore } from "../../core/checkout/types";
import { ingestProviderEvent } from "./ingest-provider-event";
import type { ElectronicPaymentProvider } from "./provider";

export type HandlePaystackWebhookInput = {
  readonly correlationIdHeader?: string;
  readonly rawBody: string;
  readonly signature: string | null;
  readonly now: Date;
  readonly checkoutStore: CheckoutStore;
  readonly provider?: ElectronicPaymentProvider;
};

export type HandlePaystackWebhookResponse = {
  readonly status: number;
  readonly body: unknown;
};

export async function handlePaystackWebhook(input: HandlePaystackWebhookInput): Promise<HandlePaystackWebhookResponse> {
  const correlation = resolveCorrelationId(input.correlationIdHeader);
  if (!input.provider) {
    return {
      status: 503,
      body: apiFailure("INTEGRATION_UNAVAILABLE", "electronic payment provider is not configured", correlation.correlationId),
    };
  }
  const result = await ingestProviderEvent({
    store: input.checkoutStore,
    provider: input.provider,
    rawBody: input.rawBody,
    signature: input.signature,
    now: input.now,
  });
  if (!result.accepted) {
    return { status: 401, body: { ok: false } };
  }
  return { status: 200, body: { ok: true } };
}
