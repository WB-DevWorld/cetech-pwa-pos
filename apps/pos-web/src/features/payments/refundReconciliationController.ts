import type { ApiFailure, RefundState } from "../../../../../docs/contracts/domain.generated";
import type { ApiResult, PaymentPort } from "../../../../../docs/contracts/ports";
import { cashierErrorMessage } from "../../ui/cashier-language";
import {
  idleRefundReconciliation,
  type RefundReconciliationView,
} from "./refundReconciliationView";

export type RefundReconciliationPorts = {
  readonly payments: Pick<PaymentPort, "resolveRefund">;
};

type UnknownOutcome = { readonly kind: "unknown"; readonly message: string };
type KnownOutcome<T> = { readonly kind: "result"; readonly value: ApiResult<T> };
type Settled<T> = UnknownOutcome | KnownOutcome<T>;

async function settle<T>(run: () => Promise<ApiResult<T>>): Promise<Settled<T>> {
  try {
    return { kind: "result", value: await run() };
  } catch (error) {
    return {
      kind: "unknown",
      message: cashierErrorMessage(
        { message: error instanceof Error ? error.message : undefined },
        "payment",
      ),
    };
  }
}

function shouldResolveFailure(failure: ApiFailure): boolean {
  return failure.error.nextAction === "resolve";
}

function viewFromState(state: RefundState, previousId: string): RefundReconciliationView {
  return {
    refundId: state.refundId || previousId,
    returnId: state.returnId,
    channel: state.channel,
    status: state.status,
    amount: state.amount,
    message:
      state.status === "pending"
        ? "This refund is still pending. Do not issue another refund."
        : state.status === "requires_attention"
          ? "This refund needs manager review. Do not issue another refund."
          : state.status === "failed"
            ? "This refund failed. Resolve the same refund identity. Do not start a replacement refund."
            : "The server verified this refund identity.",
    warning: state.status === "verified" ? undefined : "Do not issue another refund.",
    resolveAllowed: state.status !== "verified",
  };
}

export function createRefundReconciliationController(
  ports: RefundReconciliationPorts,
  refundId: string,
) {
  let session: RefundReconciliationView = idleRefundReconciliation(refundId);
  let commandLock = false;
  const boundRefundId = refundId;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function setSession(next: RefundReconciliationView): void {
    session = { ...next, refundId: boundRefundId };
    notify();
  }

  async function resolveUnlocked(): Promise<void> {
    const outcome = await settle(() => ports.payments.resolveRefund({ refundId: boundRefundId }));
    if (outcome.kind === "unknown") {
      setSession({
        refundId: boundRefundId,
        returnId: session.returnId,
        channel: session.channel,
        status: "unknown",
        amount: session.amount,
        message: `${outcome.message} Keep this refund. Do not start another refund.`,
        warning: "Do not issue another refund.",
        resolveAllowed: true,
      });
      return;
    }
    if (!outcome.value.ok && shouldResolveFailure(outcome.value)) {
      setSession({
        refundId: boundRefundId,
        returnId: session.returnId,
        channel: session.channel,
        status: "unknown",
        amount: session.amount,
        message: `${cashierErrorMessage(outcome.value.error, "payment")} Keep this refund. Do not start another refund.`,
        warning: "Do not issue another refund.",
        resolveAllowed: true,
      });
      return;
    }
    if (outcome.kind === "result" && outcome.value.ok) {
      setSession(viewFromState(outcome.value.data, boundRefundId));
      return;
    }
    if (outcome.kind === "result" && !outcome.value.ok) {
      setSession({
        refundId: boundRefundId,
        status: "unknown",
        message: `${cashierErrorMessage(outcome.value.error, "payment")} Keep this refund. Do not start another refund.`,
        warning: "Do not issue another refund.",
        resolveAllowed: outcome.value.error.nextAction === "resolve",
      });
    }
  }

  return {
    getSession(): RefundReconciliationView {
      return session;
    },
    boundRefundId(): string {
      return boundRefundId;
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isLocked(): boolean {
      return commandLock;
    },
    async resolve(): Promise<void> {
      if (commandLock) {
        return;
      }
      commandLock = true;
      try {
        await resolveUnlocked();
      } finally {
        commandLock = false;
        notify();
      }
    },
  };
}

export type RefundReconciliationController = ReturnType<typeof createRefundReconciliationController>;
