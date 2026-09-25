import type { PendingOperation } from "../../../../docs/contracts/domain.generated";

/**
 * Local recovery scope stored beside a journal row. It is not commerce truth
 * and it is not an authorization decision. Absent actor means the original
 * cashier was not recorded; callers must not invent one.
 */
export type JournalRecoveryScope = {
  readonly createdByActorId?: string;
  readonly organizationId?: string;
  readonly locationId?: string;
  readonly registerId?: string;
  readonly deviceId?: string;
};

export type LocalRecoveryViewer = {
  readonly actorId: string;
  readonly registerId?: string | null;
  readonly organizationId?: string | null;
};

export type JournalOperationRecoveryClass = {
  readonly operation: PendingOperation["operation"];
  readonly actorRelevant: boolean;
  readonly registerRelevant: boolean;
  readonly deviceRelevant: boolean;
  readonly financialRisk: boolean;
  readonly blocksMatchingRegister: boolean;
  readonly blocksUnrelatedRegister: boolean;
};

const FINANCIAL_REGISTER_BLOCK = {
  actorRelevant: true,
  registerRelevant: true,
  deviceRelevant: true,
  financialRisk: true,
  blocksMatchingRegister: true,
  blocksUnrelatedRegister: false,
} as const;

/**
 * Every operation the frozen journal contract can store. Device relevance means
 * the unresolved row lives only in this browser's database. It is not synced.
 */
export const JOURNAL_OPERATION_RECOVERY: readonly JournalOperationRecoveryClass[] = [
  { operation: "sale.prepare", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "sale.finalize", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "sale.cancel", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "payment.initialize", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "payment.cash", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "payment.resolve", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "payment.refund", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "refund.resolve", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "return.execute", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "return.resolve", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "bridge.commercial_refund", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "cash.movement", ...FINANCIAL_REGISTER_BLOCK },
  { operation: "shift.open", ...FINANCIAL_REGISTER_BLOCK, financialRisk: false },
  { operation: "shift.close", ...FINANCIAL_REGISTER_BLOCK, financialRisk: false },
  { operation: "bridge.stock_disposition", ...FINANCIAL_REGISTER_BLOCK },
];

const RECOVERY_BY_OPERATION = new Map(
  JOURNAL_OPERATION_RECOVERY.map((row) => [row.operation, row]),
);

export function classifyJournalOperation(
  operation: PendingOperation["operation"],
): JournalOperationRecoveryClass {
  const found = RECOVERY_BY_OPERATION.get(operation);
  if (!found) {
    return {
      operation,
      actorRelevant: true,
      registerRelevant: true,
      deviceRelevant: true,
      financialRisk: true,
      blocksMatchingRegister: true,
      blocksUnrelatedRegister: false,
    };
  }
  return found;
}

export function recoveryKindForOperation(
  operation: PendingOperation["operation"],
): "sale" | "payment" | null {
  if (operation === "sale.prepare" || operation === "sale.finalize" || operation === "sale.cancel") {
    return "sale";
  }
  if (operation === "payment.initialize" || operation === "payment.cash" || operation === "payment.resolve") {
    return "payment";
  }
  return null;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function deriveRecoveryScopeFromPayload(payload: string | undefined): JournalRecoveryScope {
  if (!payload) return {};
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const root = parsed as { request?: unknown };
    const request = root.request && typeof root.request === "object" ? root.request as Record<string, unknown> : root as Record<string, unknown>;
    return {
      registerId: nonEmpty(request.registerId),
      deviceId: nonEmpty(request.deviceId),
      locationId: nonEmpty(request.locationId),
      organizationId: nonEmpty(request.organizationId),
    };
  } catch {
    return {};
  }
}

export function mergeRecoveryScope(
  stored: JournalRecoveryScope | undefined,
  derived: JournalRecoveryScope,
): JournalRecoveryScope {
  return {
    registerId: stored?.registerId ?? derived.registerId,
    deviceId: stored?.deviceId ?? derived.deviceId,
    locationId: stored?.locationId ?? derived.locationId,
    organizationId: stored?.organizationId ?? derived.organizationId,
    createdByActorId: stored?.createdByActorId,
  };
}

export type ScopedJournalRow = {
  readonly id: string;
  readonly operation: PendingOperation["operation"];
  readonly status: PendingOperation["status"];
  readonly transactionId?: string;
  readonly idempotencyKey: string;
  readonly scope: JournalRecoveryScope;
};

export function presentLocalRecovery(input: {
  readonly row: ScopedJournalRow;
  readonly viewer?: LocalRecoveryViewer;
}): {
  readonly blocksCheckout: boolean;
  readonly title: string;
  readonly summary: string;
  readonly authoredByViewer: boolean;
  readonly actorKnown: boolean;
} {
  const classification = classifyJournalOperation(input.row.operation);
  const actorId = input.row.scope.createdByActorId;
  const actorKnown = Boolean(actorId);
  const authoredByViewer = Boolean(actorId && input.viewer?.actorId && actorId === input.viewer.actorId);
  const registerId = input.row.scope.registerId;
  const viewerRegister = input.viewer?.registerId ?? null;
  let blocksCheckout = false;
  if (classification.blocksMatchingRegister) {
    if (!registerId || !viewerRegister) {
      blocksCheckout = true;
    } else {
      blocksCheckout = registerId === viewerRegister;
    }
  }
  const kind = recoveryKindForOperation(input.row.operation);
  const subject = kind === "payment" ? "payment" : kind === "sale" ? "sale" : "saved action";
  const title = kind === "payment"
    ? "Payment needs a status check"
    : kind === "sale"
      ? "Sale needs a status check"
      : "Saved work needs a status check";
  let summary: string;
  if (authoredByViewer) {
    summary = blocksCheckout
      ? `This ${subject} needs a status check before another payment on this register.`
      : `This ${subject} still needs a status check on another register. You can keep selling here. Do not start that ${subject} again.`;
  } else if (actorKnown) {
    summary = blocksCheckout
      ? `Another cashier started this ${subject}. It was not started in your current sign-in. Check that transaction before taking a payment on this register.`
      : `Another cashier started this ${subject} on a different register. It was not started in your current sign-in. You can keep selling here. Do not start that ${subject} again.`;
  } else {
    summary = blocksCheckout
      ? `An earlier sign-in on this device left this ${subject} unfinished. The original cashier was not recorded. Check that transaction before taking a payment on this register.`
      : `An earlier sign-in on this device left this ${subject} unfinished on a different register. The original cashier was not recorded. You can keep selling here. Do not start that ${subject} again.`;
  }
  return { blocksCheckout, title, summary, authoredByViewer, actorKnown };
}
