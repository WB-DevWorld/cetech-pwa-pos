import type { OperationJournal, PaymentPort, SalesPort } from "../../../../docs/contracts/ports";
import type { PendingOperation } from "../../../../docs/contracts/domain.generated";
import { listUnresolvedJournalRecords } from "../local/operation-journal";
import {
  presentLocalRecovery,
  recoveryKindForOperation,
  type LocalRecoveryViewer,
} from "../local/journal-recovery-scope";
import type { PosLocalDatabase } from "../local/pos-local-db";
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
  viewer?: LocalRecoveryViewer,
  db?: PosLocalDatabase,
): Promise<readonly AttentionItemView[]> {
  if (!db && !journal) return [];
  const records = db ? await listUnresolvedJournalRecords(db) : [];
  if (!db) {
    const pending = await journal!.pending();
    return pending.flatMap((row) => presentPendingWithoutDatabase(row, viewer));
  }
  return records.flatMap((record): AttentionItemView[] => {
    if (!record.pending.transactionId && recoveryKindForOperation(record.pending.operation)) {
      return [];
    }
    const presented = presentLocalRecovery({
      row: {
        id: record.pending.id,
        operation: record.pending.operation,
        status: record.pending.status,
        transactionId: record.pending.transactionId,
        idempotencyKey: record.pending.idempotencyKey,
        scope: record.scope,
      },
      viewer,
    });
    const recoverKind = localJournalRecoveryKind(record.pending.operation);
    const uncertain = record.pending.status === "response_unknown" || record.pending.status === "requires_attention";
    return [{
      id: `local-journal:${record.pending.id}`,
      title: presented.title,
      summary: presented.summary,
      typeLabel: recoverKind === "payment" ? "Payment recovery" : recoverKind === "sale" ? "Sale recovery" : "Saved work",
      severity: uncertain || presented.blocksCheckout ? "critical" : "medium",
      transactionId: record.pending.transactionId,
      resolveAllowed: recoverKind !== null,
      retryAllowed: false,
      reviewAllowed: false,
      recoverKind: recoverKind ?? undefined,
      blocksCheckout: presented.blocksCheckout,
      localRecoveryOwner: presented.authoredByViewer ? "viewer" : presented.actorKnown ? "other" : "unknown",
    }];
  });
}

function presentPendingWithoutDatabase(
  row: PendingOperation,
  viewer: LocalRecoveryViewer | undefined,
): AttentionItemView[] {
  if (!row.transactionId) return [];
  const recoverKind = localJournalRecoveryKind(row.operation);
  if (!recoverKind) return [];
  const presented = presentLocalRecovery({
    row: {
      id: row.id,
      operation: row.operation,
      status: row.status,
      transactionId: row.transactionId,
      idempotencyKey: row.idempotencyKey,
      scope: {},
    },
    viewer,
  });
  return [{
    id: `local-journal:${row.id}`,
    title: presented.title,
    summary: presented.summary,
    typeLabel: recoverKind === "payment" ? "Payment recovery" : "Sale recovery",
    severity: "critical",
    transactionId: row.transactionId,
    resolveAllowed: true,
    retryAllowed: false,
    reviewAllowed: false,
    recoverKind,
    blocksCheckout: true,
    localRecoveryOwner: "unknown",
  }];
}

export function localRecoverySellBanner(
  checked: boolean,
  items: readonly AttentionItemView[],
): { readonly title: string; readonly detail: string } | null {
  if (!checked) {
    return {
      title: "Checking saved transaction work…",
      detail: "Checkout will stay unavailable until saved transaction work has been checked.",
    };
  }
  if (!hasBlockingLocalTransactionRecovery(items)) {
    return null;
  }
  const anotherSignIn = items.some(
    (item) =>
      item.id.startsWith("local-journal:") &&
      item.blocksCheckout !== false &&
      item.localRecoveryOwner !== "viewer",
  );
  if (anotherSignIn) {
    return {
      title: "This register needs a status check.",
      detail:
        "Unfinished work from another sign-in is still on this register. Open Needs attention and check that transaction before taking a payment. Do not start it again.",
    };
  }
  return {
    title: "Previous transaction needs a status check.",
    detail: "Open Needs attention and check the existing transaction before taking another payment.",
  };
}

export function hasBlockingLocalTransactionRecovery(
  items: readonly AttentionItemView[],
): boolean {
  return items.some(
    (item) =>
      item.id.startsWith("local-journal:") &&
      item.blocksCheckout !== false &&
      (item.recoverKind === "sale" || item.recoverKind === "payment" || item.recoverKind === undefined),
  );
}

export function mergeAttentionItems(
  serverItems: readonly AttentionItemView[],
  localItems: readonly AttentionItemView[],
  extras: readonly AttentionItemView[],
): readonly AttentionItemView[] {
  const next: AttentionItemView[] = [...localItems];
  for (const server of serverItems) {
    const duplicate = next.some(
      (item) =>
        Boolean(item.transactionId) &&
        item.transactionId === server.transactionId &&
        item.recoverKind === server.recoverKind &&
        item.resolveAllowed &&
        server.resolveAllowed,
    );
    if (!duplicate) next.push(server);
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
    if (item.id.startsWith("local-journal:")) {
      await ports.sales.resolve(item.transactionId);
    }
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
