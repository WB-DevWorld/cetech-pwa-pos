import type {
  IndependentEffectStatus,
  IndependentEffectSummary,
  RefundState,
  ReturnResolution,
  SettledIndependentEffectSummary,
  Uuid,
} from "../../../../../docs/contracts/domain.generated";

export type EffectRecord = {
  readonly effectId?: Uuid;
  readonly status: IndependentEffectStatus;
};

export function independentSummary(effect: EffectRecord): IndependentEffectSummary {
  if (effect.status === "not_required" || effect.status === "not_started") {
    return effect.effectId
      ? { effectId: effect.effectId, status: effect.status }
      : { status: effect.status };
  }
  if (!effect.effectId) {
    throw new Error(`${effect.status} independent effect requires effectId`);
  }
  return { effectId: effect.effectId, status: effect.status };
}

export function settledSummary(effect: EffectRecord): SettledIndependentEffectSummary {
  if (effect.status === "not_required") {
    return effect.effectId ? { effectId: effect.effectId, status: "not_required" } : { status: "not_required" };
  }
  if (effect.status !== "completed" || !effect.effectId) {
    throw new Error("settled completed effect requires effectId");
  }
  return { effectId: effect.effectId, status: "completed" };
}

export function refundToIndependent(status: RefundState["status"]): IndependentEffectStatus {
  if (status === "verified") {
    return "completed";
  }
  if (status === "pending") {
    return "pending";
  }
  return "requires_attention";
}

export function monotonicIndependent(
  current: IndependentEffectStatus,
  incoming: IndependentEffectStatus,
): IndependentEffectStatus {
  if (current === "completed") {
    return "completed";
  }
  return incoming;
}

export function monotonicRefund(
  current: RefundState["status"],
  incoming: RefundState["status"],
): RefundState["status"] {
  if (current === "verified") {
    return "verified";
  }
  return incoming;
}

export function computeReturnResolution(input: {
  readonly returnId: Uuid;
  readonly executed: boolean;
  readonly approvalRequired: boolean;
  readonly providerRefund: EffectRecord;
  readonly cashRefund: EffectRecord;
  readonly commercialRefund: EffectRecord;
  readonly stockDisposition: EffectRecord;
  readonly message?: string;
}): ReturnResolution {
  const effects = [
    input.providerRefund,
    input.cashRefund,
    input.commercialRefund,
    input.stockDisposition,
  ];
  const attention = effects.some((effect) => effect.status === "requires_attention");
  const outstanding = effects.some(
    (effect) =>
      effect.status === "pending" ||
      effect.status === "not_found" ||
      effect.status === "not_started",
  );
  const settled = effects.every((effect) => effect.status === "completed" || effect.status === "not_required");

  if (!input.executed) {
    return openResolution(input, input.approvalRequired ? "approval_required" : "previewed");
  }
  if (attention) {
    return openResolution(input, "requires_attention");
  }
  if (settled) {
    return {
      returnId: input.returnId,
      status: "completed",
      ...(input.message ? { message: input.message } : {}),
      providerRefund: settledSummary(input.providerRefund),
      cashRefund: settledSummary(input.cashRefund),
      commercialRefund: settledSummary(input.commercialRefund),
      stockDisposition: settledSummary(input.stockDisposition),
    };
  }
  if (outstanding) {
    const moneyOutstanding =
      isOutstanding(input.providerRefund) || isOutstanding(input.cashRefund);
    const othersSettled =
      isSettled(input.commercialRefund) && isSettled(input.stockDisposition);
    if (moneyOutstanding && othersSettled) {
      return openResolution(input, "refund_pending");
    }
    return openResolution(input, "in_progress");
  }
  return openResolution(input, "in_progress");
}

function isOutstanding(effect: EffectRecord): boolean {
  return effect.status === "pending" || effect.status === "not_found" || effect.status === "not_started";
}

function isSettled(effect: EffectRecord): boolean {
  return effect.status === "completed" || effect.status === "not_required";
}

function openResolution(
  input: {
    readonly returnId: Uuid;
    readonly providerRefund: EffectRecord;
    readonly cashRefund: EffectRecord;
    readonly commercialRefund: EffectRecord;
    readonly stockDisposition: EffectRecord;
    readonly message?: string;
  },
  status: Exclude<ReturnResolution["status"], "completed">,
): ReturnResolution {
  return {
    returnId: input.returnId,
    status,
    ...(input.message ? { message: input.message } : {}),
    providerRefund: independentSummary(input.providerRefund),
    cashRefund: independentSummary(input.cashRefund),
    commercialRefund: independentSummary(input.commercialRefund),
    stockDisposition: independentSummary(input.stockDisposition),
  };
}
