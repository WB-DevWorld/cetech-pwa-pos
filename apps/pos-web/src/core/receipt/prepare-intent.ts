import type { Id, Quote, ReceiptLine, Uuid } from "../../../../../docs/contracts/domain.generated";
import { validateCanonicalDef } from "../../server/quotes/canonical-schema";

export const PREPARE_INTENT_KIND = "sale.prepare.presentation" as const;

export type PrepareIntentSnapshot = {
  readonly kind: typeof PREPARE_INTENT_KIND;
  readonly quoteId: Id;
  readonly quoteFingerprint: string;
  readonly transactionId: Uuid;
  readonly lineIds: readonly string[];
  readonly lines: readonly ReceiptLine[];
};

export function buildPrepareIntentSnapshot(input: {
  readonly quote: Quote;
  readonly transactionId: Uuid;
  readonly lines: readonly ReceiptLine[];
}): PrepareIntentSnapshot {
  return {
    kind: PREPARE_INTENT_KIND,
    quoteId: input.quote.id,
    quoteFingerprint: input.quote.fingerprint,
    transactionId: input.transactionId,
    lineIds: input.quote.lines.map((line) => line.lineId),
    lines: input.lines,
  };
}

export function prepareIntentMatchesRequest(input: {
  readonly intent: PrepareIntentSnapshot;
  readonly quoteId: Id;
  readonly quoteFingerprint: string;
  readonly transactionId: Uuid;
}): boolean {
  return (
    input.intent.quoteId === input.quoteId &&
    input.intent.quoteFingerprint === input.quoteFingerprint &&
    input.intent.transactionId === input.transactionId &&
    input.intent.lineIds.length === input.intent.lines.length
  );
}

export function isPrepareIntentSnapshot(value: unknown): value is PrepareIntentSnapshot {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.kind !== PREPARE_INTENT_KIND) {
    return false;
  }
  if (typeof record.quoteId !== "string" || record.quoteId.length < 1) {
    return false;
  }
  if (typeof record.quoteFingerprint !== "string" || record.quoteFingerprint.length < 1) {
    return false;
  }
  if (typeof record.transactionId !== "string" || record.transactionId.length < 1) {
    return false;
  }
  if (!Array.isArray(record.lineIds) || !record.lineIds.every((id) => typeof id === "string" && id.length > 0)) {
    return false;
  }
  if (!Array.isArray(record.lines) || record.lines.length !== record.lineIds.length) {
    return false;
  }
  return record.lines.every((line) => validateCanonicalDef("ReceiptLine", line));
}
