import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { PaymentState, Uuid } from "../../../../../docs/contracts/domain.generated";
import { canonicalJson, sha256Hex } from "../../local/canonical";
import { toIsoTimestamp } from "../auth/ids";
import { apiFailure } from "../http/api-failure";
import type { CheckoutStore, StaffActor, StoredPayment } from "../../core/checkout/types";
import { toPaymentState } from "./payment-state";

export const MANUAL_MOBILE_MONEY_PROVIDER = "manual_mobile_money";

export type ManualMobileMoneyInstructions = {
  readonly payment: PaymentState;
  readonly network: string;
  readonly accountLabel: string;
  readonly amountMinor: number;
  readonly currency: string;
};

export function manualMobileMoneyPolicy(env: Readonly<Record<string, string | undefined>>):
  | { readonly enabled: true; readonly network: string; readonly accountLabel: string }
  | { readonly enabled: false } {
  const enabled = env.MANUAL_MOBILE_MONEY_ENABLED?.trim().toLowerCase() === "true";
  const network = env.MANUAL_MOBILE_MONEY_NETWORK?.trim() ?? "";
  const accountLabel = env.MANUAL_MOBILE_MONEY_ACCOUNT_LABEL?.trim() ?? "";
  if (!enabled || !network || !accountLabel) return { enabled: false };
  return { enabled: true, network, accountLabel };
}

export function isManualMobileMoneyPayment(
  payment: { readonly provider?: string; readonly verificationSource?: string } | undefined,
): boolean {
  if (!payment) return false;
  return payment.provider === MANUAL_MOBILE_MONEY_PROVIDER || payment.verificationSource === "approved_external_attestation";
}

const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{3,79}$/;

export function beginManualMobileMoney(input: {
  readonly store: CheckoutStore;
  readonly actor: StaffActor;
  readonly transactionId: Uuid;
  readonly idempotencyKey: Uuid;
  readonly correlationId: Uuid;
  readonly now: Date;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly staffActive: boolean;
}): Promise<ApiResult<ManualMobileMoneyInstructions>> {
  return runManual("payment.initialize", input, input.transactionId, async (sale, policy) => {
    const existing = await input.store.getPaymentForTransaction(sale.prepared.transactionId);
    if (existing) {
      if (isManualMobileMoneyPayment(existing)) {
        return instructions(existing);
      }
      return apiFailure(
        "VALIDATION_ERROR",
        "Another tender already claims this sale. Manual Mobile Money cannot replace it.",
        input.correlationId,
      );
    }
    const paymentId = crypto.randomUUID();
    const payment: StoredPayment = {
      paymentId,
      transactionId: sale.prepared.transactionId,
      saleId: sale.prepared.saleId,
      tender: "mobile_money",
      status: "awaiting_customer",
      amount: sale.prepared.total,
      actorId: input.actor.actorId,
      provider: MANUAL_MOBILE_MONEY_PROVIDER,
      providerReference: `intent:${paymentId}`,
      initializeStatus: "initialized",
      manualNetwork: policy.network,
      merchantAccountLabel: policy.accountLabel,
      attentionReason: `Waiting for a merchant receipt on ${policy.network} / ${policy.accountLabel}.`,
    };
    try {
      await input.store.savePayment(payment);
      await input.store.saveSale({ ...sale, status: "payment_pending", assignedPaymentId: paymentId });
    } catch (error) {
      return persistenceFailure(error, input.correlationId);
    }
    const stored = await input.store.getPayment(paymentId);
    return instructions(stored ?? payment);
  });
}

export function confirmManualMobileMoney(input: {
  readonly store: CheckoutStore;
  readonly actor: StaffActor;
  readonly transactionId: Uuid;
  readonly paymentId: Uuid;
  readonly idempotencyKey: Uuid;
  readonly correlationId: Uuid;
  readonly now: Date;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly staffActive: boolean;
  readonly merchantReference: string;
  readonly merchantConfirmed: boolean;
}): Promise<ApiResult<ManualMobileMoneyInstructions>> {
  const fingerprint = `${input.transactionId}:${input.paymentId}:${input.merchantReference.trim()}:${input.merchantConfirmed ? "yes" : "no"}`;
  return runManual("payment.resolve", input, fingerprint, async (sale) => {
    if (input.merchantConfirmed !== true) {
      return apiFailure(
        "VALIDATION_ERROR",
        "Confirm only after you have checked the merchant receipt. A customer screenshot is not confirmation.",
        input.correlationId,
      );
    }
    const reference = input.merchantReference.trim();
    if (!REFERENCE.test(reference)) {
      return apiFailure("VALIDATION_ERROR", "Enter the reference from the merchant receipt.", input.correlationId);
    }
    const payment = await input.store.getPayment(input.paymentId);
    if (!payment || payment.transactionId !== sale.prepared.transactionId || !isManualMobileMoneyPayment(payment)) {
      return apiFailure("VALIDATION_ERROR", "This sale does not have a manual Mobile Money intent to confirm.", input.correlationId);
    }
    if (payment.status === "verified") {
      if (payment.providerReference === reference) return instructions(payment);
      return apiFailure("VALIDATION_ERROR", "This sale was already confirmed with a different merchant reference.", input.correlationId);
    }
    const network = payment.manualNetwork?.trim() ?? "";
    const accountLabel = payment.merchantAccountLabel?.trim() ?? "";
    if (!network || !accountLabel) {
      return apiFailure(
        "REQUIRES_ATTENTION",
        "This Mobile Money intent has no saved merchant account. Do not ask for another transfer.",
        input.correlationId,
      );
    }
    const confirmed: StoredPayment = {
      ...payment,
      status: "verified",
      amount: sale.prepared.total,
      verifiedAt: toIsoTimestamp(input.now),
      verificationSource: "approved_external_attestation",
      providerReference: reference,
      displayReference: reference,
      evidenceId: payment.evidenceId ?? crypto.randomUUID(),
      manualNetwork: network,
      merchantAccountLabel: accountLabel,
      attestationActorId: input.actor.actorId,
      attentionReason: `Manual Mobile Money ${network} / ${accountLabel}. Reference ${reference}.`,
    };
    let committed: Awaited<ReturnType<CheckoutStore["commitManualAttestation"]>>;
    try {
      committed = await input.store.commitManualAttestation(confirmed);
    } catch (error) {
      return persistenceFailure(error, input.correlationId);
    }
    if (committed.kind === "stored") {
      return instructions(committed.payment);
    }
    if (committed.kind === "conflict") {
      const current = await input.store.getPayment(payment.paymentId);
      if (current?.status === "verified") {
        return apiFailure("VALIDATION_ERROR", "This sale was already confirmed with a different merchant reference.", input.correlationId);
      }
      return apiFailure("VALIDATION_ERROR", "That merchant reference is already used on another sale.", input.correlationId);
    }
    return apiFailure(
      "REQUIRES_ATTENTION",
      "The confirmation was not saved. Do not ask for another transfer. A manager must recover this sale.",
      input.correlationId,
    );
  });
}

async function runManual(
  operation: "payment.initialize" | "payment.resolve",
  input: {
    readonly store: CheckoutStore;
    readonly actor: StaffActor;
    readonly transactionId: Uuid;
    readonly idempotencyKey: Uuid;
    readonly correlationId: Uuid;
    readonly now: Date;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly staffActive: boolean;
  },
  fingerprint: string,
  work: (
    sale: NonNullable<Awaited<ReturnType<CheckoutStore["getSale"]>>>,
    policy: { readonly network: string; readonly accountLabel: string },
  ) => Promise<ApiResult<ManualMobileMoneyInstructions>>,
): Promise<ApiResult<ManualMobileMoneyInstructions>> {
  if (!input.staffActive) {
    return apiFailure("FORBIDDEN", "Disabled staff cannot confirm or start manual Mobile Money.", input.correlationId);
  }
  const sale = await input.store.getSale(input.transactionId);
  if (!sale) return apiFailure("NOT_FOUND", "prepared sale was not found", input.correlationId);
  if (sale.organizationId !== input.actor.organizationId || !input.actor.locationIds.includes(sale.locationId)) {
    return apiFailure("FORBIDDEN", "This sale is outside the current staff session.", input.correlationId);
  }
  const hash = await sha256Hex(canonicalJson({ operation, fingerprint }));
  const claim = await input.store.claimIdempotency(
    input.actor.organizationId,
    operation,
    input.idempotencyKey,
    hash,
    sale.locationId,
    { transactionId: input.transactionId, registerId: sale.registerId, shiftId: sale.shiftId },
  );
  const recoveredNow = await recoverVerifiedManual(input.store, sale.prepared.transactionId);
  if ((claim.kind === "replay" || claim.kind === "repair") && recoveredNow) {
    return { ...recoveredNow, correlationId: input.correlationId };
  }
  if ((claim.kind === "replay" || claim.kind === "repair") && isInstructions(claim.outcome)) {
    return { ok: true, data: claim.outcome, correlationId: input.correlationId };
  }
  const recovered = recoveredNow;
  if (recovered?.ok && (claim.kind === "acquired" || claim.kind === "in_progress" || claim.kind === "replay" || claim.kind === "repair")) {
    await input.store.markIdempotencySent(input.actor.organizationId, operation, input.idempotencyKey);
    await input.store.acknowledgeIdempotency(input.actor.organizationId, operation, input.idempotencyKey, recovered.data);
    return { ...recovered, correlationId: input.correlationId };
  }
  if (claim.kind === "conflict") {
    return apiFailure("IDEMPOTENCY_CONFLICT", "This confirmation key was already used for a different request.", input.correlationId);
  }
  if (claim.kind === "in_progress") {
    return apiFailure("OPERATION_IN_PROGRESS", "This confirmation is already in progress. Do not ask for another transfer.", input.correlationId);
  }
  const policy = manualMobileMoneyPolicy(input.env);
  if (!policy.enabled) {
    return apiFailure("VALIDATION_ERROR", "Manually confirmed Mobile Money is not set up for this register.", input.correlationId);
  }
  if (sale.status === "completed" || sale.status === "cancelled") {
    return apiFailure("VALIDATION_ERROR", "This sale is already finished.", input.correlationId);
  }
  if (Date.parse(sale.prepared.expiresAt) <= input.now.getTime()) {
    return apiFailure(
      "QUOTE_EXPIRED",
      "The stock reservation has expired. Do not record a transfer against this sale.",
      input.correlationId,
    );
  }
  await input.store.markIdempotencySent(input.actor.organizationId, operation, input.idempotencyKey);
  const result = await work(sale, policy);
  const correlated = { ...result, correlationId: input.correlationId };
  if (correlated.ok) {
    await input.store.acknowledgeIdempotency(input.actor.organizationId, operation, input.idempotencyKey, correlated.data);
  } else if (!correlated.ok && correlated.error.code === "REQUIRES_ATTENTION") {
    await input.store.markIdempotencyRequiresAttention(
      input.actor.organizationId,
      operation,
      input.idempotencyKey,
      correlated,
    );
  } else {
    await input.store.releaseIdempotency(input.actor.organizationId, operation, input.idempotencyKey);
  }
  return correlated;
}

async function recoverVerifiedManual(
  store: CheckoutStore,
  transactionId: Uuid,
): Promise<ApiResult<ManualMobileMoneyInstructions> | undefined> {
  const payment = await store.getPaymentForTransaction(transactionId);
  if (!payment || payment.status !== "verified" || !isManualMobileMoneyPayment(payment)) {
    return undefined;
  }
  return instructions(payment);
}

function instructions(payment: StoredPayment): ApiResult<ManualMobileMoneyInstructions> {
  return {
    ok: true,
    data: {
      payment: toPaymentState(payment),
      network: payment.manualNetwork?.trim() || "Saved network unavailable",
      accountLabel: payment.merchantAccountLabel?.trim() || "Saved account unavailable",
      amountMinor: payment.amount.minor,
      currency: payment.amount.currency,
    },
    correlationId: payment.transactionId,
  };
}

function persistenceFailure(error: unknown, correlationId: Uuid): ApiResult<ManualMobileMoneyInstructions> {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("sale tender family conflict") || message.includes("one payment intent")) {
    return apiFailure("VALIDATION_ERROR", "Another tender already claims this sale.", correlationId);
  }
  if (message.includes("provider reference already exists")) {
    return apiFailure("VALIDATION_ERROR", "That merchant reference is already used on another sale.", correlationId);
  }
  return apiFailure(
    "REQUIRES_ATTENTION",
    "The confirmation was not saved. Do not ask for another transfer. A manager must recover this sale.",
    correlationId,
  );
}

function isInstructions(value: unknown): value is ManualMobileMoneyInstructions {
  if (!value || typeof value !== "object") return false;
  const row = value as { payment?: { paymentId?: unknown } };
  return typeof row.payment?.paymentId === "string";
}
