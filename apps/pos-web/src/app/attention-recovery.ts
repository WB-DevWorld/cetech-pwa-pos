import type { OperationJournal, PaymentPort, SalesPort } from "../../../../docs/contracts/ports";
import type { PendingOperation } from "../../../../docs/contracts/domain.generated";
import type { AttentionItemView } from "../ui/operational";


const SALE_RECOVERY_OPERATIONS = new Set<PendingOperation["operation"]>([
  "sale.prepare",
  "sale.finalize",
  "sale.cancel",
]);

const PAYMENT_RECOVERY_OPERATIONS = new Set<PendingOperation["operation"]>([
  "payment.initialize",
  "payment.cash",
  "payment.resolve",
]);

export function localJournalRecoveryKind(
  operation: PendingOperation["operation"],
): "sale" | "payment" | null {
  if (SALE_RECOVERY_OPERATIONS.has(operation)) return "sale";
  if (PAYMENT_RECOVERY_OPERATIONS.has(operation)) return "payment";
  return null;
}

export async function loadLocalJournalAttentionItems(
  journal: OperationJournal | undefined,
): Promise<readonly AttentionItemView[]> {
  if (!journal) return [];
  const pending = await journal.pending();
  return pending.flatMap((row): AttentionItemView[] => {
    if (!row.transactionId) return [];
    const recoverKind = localJournalRecoveryKind(row.operation);
    if (!recoverKind) return [];
    const uncertain = row.status === "response_unknown" || row.status === "requires_attention";
    return [{
      id: `local-journal:${row.id}`,
      title: recoverKind === "payment" ? "Payment needs a status check" : "Sale needs a status check",
      summary: uncertain
        ? "The result was not confirmed. Check the existing transaction before starting another attempt."
        : "Saved transaction work was interrupted. Check its status before starting another attempt.",
      typeLabel: recoverKind === "payment" ? "Payment recovery" : "Sale recovery",
      severity: uncertain ? "critical" : "medium",
      transactionId: row.transactionId,
      resolveAllowed: true,
      retryAllowed: false,
      reviewAllowed: false,
      recoverKind,
    }];
  });
}

export function hasBlockingLocalTransactionRecovery(
  items: readonly AttentionItemView[],
): boolean {
  return items.some(
    (item) =>
      item.id.startsWith("local-journal:") &&
      item.resolveAllowed &&
      (item.recoverKind === "sale" || item.recoverKind === "payment"),
  );
}

export function mergeAttentionItems(
  serverItems: readonly AttentionItemView[],
  localItems: readonly AttentionItemView[],
  extras: readonly AttentionItemView[],
): readonly AttentionItemView[] {
  const next: AttentionItemView[] = [...serverItems];
  for (const local of localItems) {
    const duplicate = next.some(
      (item) =>
        Boolean(item.transactionId) &&
        item.transactionId === local.transactionId &&
        item.recoverKind === local.recoverKind &&
        item.resolveAllowed,
    );
    if (!duplicate) next.push(local);
  }
  next.push(...extras);
  return next;
}

export type AttentionRecoveryPorts = {
  readonly payments: Pick<PaymentPort, "resolve">;
  readonly sales: Pick<SalesPort, "resolve">;
};

export type AttentionRecoveryLock = {
  readonly inFlightId: () => string | null;
  readonly tryBegin: (id: string) => boolean;
  readonly end: (id: string) => void;
};

export type AttentionRecoveryStatus = "in_flight" | "unsupported" | "attempted";

export function createAttentionRecoveryLock(): AttentionRecoveryLock {
  let inFlightId: string | null = null;
  return {
    inFlightId: () => inFlightId,
    tryBegin(id) {
      if (inFlightId) {
        return false;
      }
      inFlightId = id;
      return true;
    },
    end(id) {
      if (inFlightId === id) {
        inFlightId = null;
      }
    },
  };
}

export async function recoverAttentionItem(
  item: AttentionItemView,
  ports: AttentionRecoveryPorts,
): Promise<"unsupported" | "attempted"> {
  if (!item.resolveAllowed || !item.transactionId) {
    return "unsupported";
  }
  if (item.recoverKind === "payment") {
    await ports.payments.resolve({
      transactionId: item.transactionId,
      paymentId: item.paymentId,
    });
    return "attempted";
  }
  if (item.recoverKind === "sale") {
    await ports.sales.resolve(item.transactionId);
    return "attempted";
  }
  return "unsupported";
}

export async function runAttentionRecovery(input: {
  readonly item: AttentionItemView;
  readonly lock: AttentionRecoveryLock;
  readonly ports: AttentionRecoveryPorts;
  readonly reload: () => Promise<void>;
  readonly onStart?: (id: string) => void;
  readonly onFinish?: (id: string) => void;
}): Promise<AttentionRecoveryStatus> {
  if (!input.lock.tryBegin(input.item.id)) {
    return "in_flight";
  }
  input.onStart?.(input.item.id);
  try {
    await recoverAttentionItem(input.item, input.ports);
    return "attempted";
  } finally {
    try {
      await input.reload();
    } finally {
      input.lock.end(input.item.id);
      input.onFinish?.(input.item.id);
    }
  }
}
