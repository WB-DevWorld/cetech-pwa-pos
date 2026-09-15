import { sha256Hex } from "../../local/canonical";
import { toIsoTimestamp } from "../auth/ids";
import type { CheckoutStore, StoredPayment, StoredProviderEvent } from "../../core/checkout/types";
import { applyProviderVerification } from "./apply-verification";
import type { ElectronicPaymentProvider } from "./provider";

export type IngestProviderEventResult = {
  readonly accepted: boolean;
  readonly duplicate: boolean;
  readonly payment?: StoredPayment;
};

export async function ingestProviderEvent(input: {
  readonly store: CheckoutStore;
  readonly provider: ElectronicPaymentProvider;
  readonly rawBody: string;
  readonly signature: string | null;
  readonly now: Date;
}): Promise<IngestProviderEventResult> {
  if (!input.provider.authenticateWebhook(input.rawBody, input.signature)) {
    return { accepted: false, duplicate: false };
  }
  const event = input.provider.parseWebhook(input.rawBody);
  if (!event) {
    return { accepted: false, duplicate: false };
  }
  const rawBodyHash = await sha256Hex(input.rawBody);
  const fingerprint = await sha256Hex(
    `${input.provider.id}:${event.eventType}:${event.reference ?? ""}:${rawBodyHash}`,
  );
  const local = event.reference
    ? await input.store.getPaymentByProviderReference(input.provider.id, event.reference)
    : undefined;
  const sale = local ? await input.store.getSale(local.transactionId) : undefined;
  const record: StoredProviderEvent = {
    id: crypto.randomUUID(),
    organizationId: sale?.organizationId,
    locationId: sale?.locationId,
    provider: input.provider.id,
    providerReference: event.reference,
    providerTransactionId: event.providerTransactionId,
    eventType: event.eventType,
    eventFingerprint: fingerprint,
    rawBodyHash,
    receivedAt: toIsoTimestamp(input.now),
    processingStatus: local ? "ingested" : "ignored",
    normalizedStatus: event.providerStatus,
    paymentId: local?.paymentId,
    transactionId: local?.transactionId,
  };
  const saved = await input.store.saveProviderEvent(record);
  if (saved === "duplicate") {
    return { accepted: true, duplicate: true, payment: local };
  }
  if (!local || !local.providerReference) {
    return { accepted: true, duplicate: false };
  }
  const verification = await input.provider.verify(local.providerReference);
  if (!sale) {
    return { accepted: true, duplicate: false, payment: local };
  }
  const payment = await applyProviderVerification({
    store: input.store,
    sale,
    payment: local,
    verification,
    now: input.now,
  });
  return { accepted: true, duplicate: false, payment };
}
