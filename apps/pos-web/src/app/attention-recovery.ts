import type { PaymentPort, SalesPort } from "../../../../docs/contracts/ports";
import type { AttentionItemView } from "../ui/operational";

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
