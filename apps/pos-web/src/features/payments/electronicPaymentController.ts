import type {
  ApiFailure,
  CommandContext,
  ElectronicTender,
  PaymentState,
} from "../../../../../docs/contracts/domain.generated";
import type { ApiResult, PaymentPort } from "../../../../../docs/contracts/ports";
import {
  describeElectronicPayment,
  idleElectronicPaymentSession,
  type ElectronicPaymentSessionView,
  type ElectronicTenderView,
} from "./electronicPaymentView";

export type ElectronicPaymentPorts = {
  readonly payments: Pick<PaymentPort, "initialize" | "resolve">;
  readonly createUuid?: () => string;
};

type UnknownOutcome = { readonly kind: "unknown"; readonly message: string };
type KnownOutcome<T> = { readonly kind: "result"; readonly value: ApiResult<T> };
type Settled<T> = UnknownOutcome | KnownOutcome<T>;

function defaultUuid(): string {
  return crypto.randomUUID();
}

async function settle<T>(run: () => Promise<ApiResult<T>>): Promise<Settled<T>> {
  try {
    return { kind: "result", value: await run() };
  } catch (error) {
    return {
      kind: "unknown",
      message: error instanceof Error ? error.message : "The operation result is unknown.",
    };
  }
}

function shouldResolveFailure(failure: ApiFailure): boolean {
  return failure.error.nextAction === "resolve";
}

function asTenderView(tender: PaymentState["tender"]): ElectronicTenderView | undefined {
  if (tender === "mobile_money" || tender === "card" || tender === "external_electronic") {
    return tender;
  }
  return undefined;
}

function sessionFromState(
  state: PaymentState,
  extras?: Partial<ElectronicPaymentSessionView>,
): ElectronicPaymentSessionView {
  const copy = describeElectronicPayment(state.status, state.nextAction);
  return {
    status: state.status,
    nextAction: state.nextAction,
    transactionId: state.transactionId,
    paymentId: state.paymentId,
    tender: asTenderView(state.tender),
    amount: state.amount,
    displayReference: state.displayReference,
    message: copy.message,
    warning: copy.warning,
    doNotChargeAgain: copy.doNotChargeAgain,
    verified: copy.verified && state.status === "verified",
    presentAllowed: copy.presentAllowed,
    resolveAllowed: copy.resolveAllowed,
    contactManager: copy.contactManager,
    browserCallbackIsNotTruth: extras?.browserCallbackIsNotTruth ?? false,
  };
}

export function createElectronicPaymentController(ports: ElectronicPaymentPorts) {
  const createUuid = ports.createUuid ?? defaultUuid;
  let session: ElectronicPaymentSessionView = idleElectronicPaymentSession();
  let commandLock = false;
  let initializeContext: CommandContext | null = null;
  let boundTransactionId: string | undefined;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function setSession(next: ElectronicPaymentSessionView): void {
    session = next;
    notify();
  }

  function commandContext(): CommandContext {
    return { idempotencyKey: createUuid(), correlationId: createUuid() };
  }

  function initializeContextFor(transactionId: string): CommandContext {
    if (initializeContext && boundTransactionId === transactionId) {
      return initializeContext;
    }
    initializeContext = commandContext();
    boundTransactionId = transactionId;
    return initializeContext;
  }

  function mustNotInitialize(): boolean {
    if (!session.paymentId) {
      return session.doNotChargeAgain;
    }
    return (
      session.doNotChargeAgain ||
      session.status === "pending" ||
      session.status === "reconciling" ||
      session.status === "initializing" ||
      session.status === "awaiting_customer" ||
      session.status === "verified" ||
      session.status === "requires_attention" ||
      session.nextAction === "wait" ||
      session.nextAction === "resolve"
    );
  }

  async function resolveUnlocked(): Promise<void> {
    const transactionId = session.transactionId ?? boundTransactionId;
    if (!transactionId) {
      return;
    }
    const outcome = await settle(() =>
      ports.payments.resolve({
        transactionId,
        paymentId: session.paymentId,
      }),
    );
    if (outcome.kind === "unknown") {
      setSession({
        ...session,
        message: `${outcome.message} Do not charge again. Resolve the existing payment.`,
        warning: "Do not charge again.",
        doNotChargeAgain: true,
        presentAllowed: false,
        resolveAllowed: true,
        verified: false,
      });
      return;
    }
    if (!outcome.value.ok && shouldResolveFailure(outcome.value)) {
      setSession({
        ...session,
        message: `${outcome.value.error.message} Do not charge again. Resolve the existing payment.`,
        warning: "Do not charge again.",
        doNotChargeAgain: true,
        presentAllowed: false,
        resolveAllowed: true,
        verified: false,
      });
      return;
    }
    if (outcome.kind === "result" && outcome.value.ok) {
      setSession(sessionFromState(outcome.value.data, { browserCallbackIsNotTruth: session.browserCallbackIsNotTruth }));
      return;
    }
    if (outcome.kind === "result" && !outcome.value.ok) {
      setSession({
        ...session,
        message: outcome.value.error.message,
        presentAllowed: false,
        resolveAllowed: outcome.value.error.nextAction === "resolve",
        verified: false,
      });
    }
  }

  async function initializeUnlocked(transactionId: string, tender: ElectronicTender): Promise<void> {
    const context = initializeContextFor(transactionId);
    setSession({
      ...session,
      status: "initializing",
      transactionId,
      tender,
      message: "Starting payment. Do not charge again.",
      warning: "Do not charge again.",
      doNotChargeAgain: true,
      presentAllowed: false,
      resolveAllowed: true,
      verified: false,
      contactManager: false,
      nextAction: "wait",
    });
    const outcome = await settle(() => ports.payments.initialize({ transactionId, tender }, context));
    if (outcome.kind === "unknown" || (outcome.kind === "result" && !outcome.value.ok && shouldResolveFailure(outcome.value))) {
      await resolveUnlocked();
      return;
    }
    if (outcome.kind === "result" && outcome.value.ok) {
      setSession(sessionFromState(outcome.value.data));
      return;
    }
    if (outcome.kind === "result" && !outcome.value.ok) {
      setSession({
        ...session,
        status: "failed",
        message: outcome.value.error.message,
        doNotChargeAgain: false,
        presentAllowed: false,
        resolveAllowed: outcome.value.error.nextAction === "resolve",
        verified: false,
      });
    }
  }

  return {
    getSession(): ElectronicPaymentSessionView {
      return session;
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
    async present(input: { readonly transactionId: string; readonly tender: ElectronicTenderView }): Promise<void> {
      if (commandLock) {
        return;
      }
      commandLock = true;
      boundTransactionId = input.transactionId;
      try {
        if (mustNotInitialize()) {
          setSession({
            ...session,
            transactionId: input.transactionId,
            message: session.message || "Payment is already in progress. Do not charge again.",
            warning: "Do not charge again.",
            doNotChargeAgain: true,
            presentAllowed: false,
            resolveAllowed: true,
          });
          await resolveUnlocked();
          return;
        }
        const probe = await settle(() =>
          ports.payments.resolve({
            transactionId: input.transactionId,
            paymentId: session.paymentId,
          }),
        );
        if (probe.kind === "unknown" || (probe.kind === "result" && !probe.value.ok && shouldResolveFailure(probe.value))) {
          setSession({
            ...idleElectronicPaymentSession(),
            status: "reconciling",
            transactionId: input.transactionId,
            paymentId: session.paymentId,
            tender: input.tender,
            message: "Payment status is uncertain. Do not charge again.",
            warning: "Do not charge again.",
            doNotChargeAgain: true,
            presentAllowed: false,
            resolveAllowed: true,
            nextAction: "resolve",
          });
          return;
        }
        if (probe.kind === "result" && probe.value.ok) {
          const existing = sessionFromState(probe.value.data);
          setSession(existing);
          if (!existing.presentAllowed || existing.doNotChargeAgain || existing.verified) {
            return;
          }
        }
        if (!session.presentAllowed && session.paymentId) {
          return;
        }
        await initializeUnlocked(input.transactionId, input.tender);
      } finally {
        commandLock = false;
        notify();
      }
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
    async noteBrowserCallback(): Promise<void> {
      if (commandLock) {
        return;
      }
      commandLock = true;
      try {
        setSession({
          ...session,
          verified: false,
          browserCallbackIsNotTruth: true,
          message: "We haven't confirmed this payment yet. Do not charge again while we check its status.",
          warning: "Do not charge again.",
          doNotChargeAgain: Boolean(session.paymentId) || session.doNotChargeAgain,
        });
        await resolveUnlocked();
      } finally {
        commandLock = false;
        notify();
      }
    },
    reset(): void {
      if (commandLock) {
        return;
      }
      initializeContext = null;
      boundTransactionId = undefined;
      setSession(idleElectronicPaymentSession());
    },
  };
}

export type ElectronicPaymentController = ReturnType<typeof createElectronicPaymentController>;
