import type {
  ApiFailure,
  CommandContext,
  PaymentState,
  PreparedSale,
  Quote,
  ReceiptSnapshot,
  SaleResolution,
} from "../../../../../../docs/contracts/domain.generated";
import type {
  ApiResult,
  CheckoutUseCases,
  PaymentPort,
  PrintPort,
  ReceiptPort,
  SalesPort,
} from "../../../../../../docs/contracts/ports";
import { parseDecimalToMinorUnits } from "../../register/parseDecimalToMinorUnits";
import {
  canBeginNewSale,
  checkoutDismissAllowed,
  idleCheckoutSession,
  type CheckoutSessionView,
  type PreparedSaleView,
  type ReceiptViewModel,
} from "../state/checkoutSession";

export type CashCheckoutScope = {
  readonly registerId: string;
  readonly shiftId: string;
  readonly deviceId: string;
};

export type CashCheckoutPorts = {
  readonly checkout: CheckoutUseCases;
  readonly payments: Pick<PaymentPort, "confirmCash" | "resolve">;
  readonly sales: Pick<SalesPort, "resolve">;
  readonly receipts: ReceiptPort;
  readonly printer: PrintPort;
  readonly scope: CashCheckoutScope;
  readonly createUuid?: () => string;
};

type AttemptIdentities = {
  readonly quoteId: string;
  readonly quoteFingerprint: string;
  readonly transactionId: string;
  readonly currency: string;
  readonly prepare: CommandContext;
  readonly cash: CommandContext;
  readonly finalize: CommandContext;
};

type UnknownOutcome = { readonly kind: "unknown"; readonly message: string };
type KnownOutcome<T> = { readonly kind: "result"; readonly value: ApiResult<T> };
type Settled<T> = UnknownOutcome | KnownOutcome<T>;

function defaultUuid(): string {
  return crypto.randomUUID();
}

function quoteMatches(identities: AttemptIdentities, quote: Quote): boolean {
  return identities.quoteId === quote.id && identities.quoteFingerprint === quote.fingerprint;
}

function mapPrepared(sale: PreparedSale): PreparedSaleView {
  return {
    transactionId: sale.transactionId,
    saleId: sale.saleId,
    orderReference: sale.orderReference,
    quoteFingerprint: sale.quoteFingerprint,
    total: sale.total,
  };
}

export function mapReceiptSnapshot(snapshot: ReceiptSnapshot): ReceiptViewModel {
  return {
    id: snapshot.id,
    transactionId: snapshot.transactionId,
    receiptNumber: snapshot.receiptNumber,
    orderReference: snapshot.orderReference,
    issuedAt: snapshot.issuedAt,
    locationName: snapshot.locationName,
    registerName: snapshot.registerName,
    cashierName: snapshot.cashierName,
    customerLabel: snapshot.customerLabel,
    lines: snapshot.lines.map((line) => ({
      name: line.name,
      variationLabel: line.variationLabel,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      total: line.total,
    })),
    subtotal: snapshot.subtotal,
    discount: snapshot.discount,
    tax: snapshot.tax,
    total: snapshot.total,
    tender: snapshot.tender,
    cashReceived: snapshot.cashReceived,
    changeDue: snapshot.changeDue,
    documentKind: snapshot.documentKind,
  };
}

export function isCashCheckoutReady(ports: CashCheckoutPorts | undefined | null): boolean {
  return Boolean(
    ports?.checkout &&
      ports.payments &&
      ports.sales &&
      ports.receipts &&
      ports.printer &&
      ports.scope.registerId &&
      ports.scope.shiftId &&
      ports.scope.deviceId,
  );
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

function paymentVerified(state: PaymentState): boolean {
  return state.status === "verified";
}

function paymentNeedsResolve(state: PaymentState): boolean {
  return (
    state.nextAction === "resolve" ||
    state.nextAction === "wait" ||
    state.status === "pending" ||
    state.status === "reconciling" ||
    state.status === "initializing" ||
    state.status === "awaiting_customer"
  );
}

function paymentAllowsCashRetry(state: PaymentState): boolean {
  return state.status === "failed" || state.status === "cancelled";
}

export function createCashCheckoutController(ports: CashCheckoutPorts) {
  const createUuid = ports.createUuid ?? defaultUuid;
  let session: CheckoutSessionView = idleCheckoutSession();
  let identities: AttemptIdentities | null = null;
  let paymentId: string | undefined;
  let commandLock = false;
  let printAttempted = false;
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function setSession(next: CheckoutSessionView): void {
    session = next;
    notify();
  }

  function patch(partial: Partial<CheckoutSessionView>): void {
    setSession({ ...session, ...partial });
  }

  function commandContext(): CommandContext {
    return { idempotencyKey: createUuid(), correlationId: createUuid() };
  }

  function identitiesFor(quote: Quote): AttemptIdentities {
    if (identities && quoteMatches(identities, quote)) {
      return identities;
    }
    if (identities && session.prepared && !session.saleCompleted) {
      return identities;
    }
    identities = {
      quoteId: quote.id,
      quoteFingerprint: quote.fingerprint,
      transactionId: createUuid(),
      currency: quote.currency,
      prepare: commandContext(),
      cash: commandContext(),
      finalize: commandContext(),
    };
    paymentId = undefined;
    printAttempted = false;
    return identities;
  }

  async function resolveSaleUnlocked(): Promise<void> {
    if (!identities) {
      return;
    }
    patch({
      stage: "resolving_sale",
      message: "Sale status is uncertain. Do not start another sale. Checking the existing transaction.",
      inputError: undefined,
    });
    const outcome = await settle(() => ports.sales.resolve(identities!.transactionId));
    if (outcome.kind === "unknown") {
      patch({
        stage: "resolving_sale",
        message: outcome.message,
      });
      return;
    }
    if (!outcome.value.ok) {
      if (shouldResolveFailure(outcome.value)) {
        patch({
          stage: "resolving_sale",
          message: outcome.value.error.message,
        });
        return;
      }
      patch({
        stage: session.saleCompleted ? "receipt_failed" : "prepare_failed",
        message: outcome.value.error.message,
      });
      return;
    }
    await applySaleResolution(outcome.value.data);
  }

  async function applySaleResolution(resolution: SaleResolution): Promise<void> {
    paymentId = resolution.paymentId ?? paymentId;
    if (resolution.status === "completed") {
      patch({
        stage: "complete",
        saleCompleted: true,
        transactionId: resolution.transactionId,
        message: "The sale is complete. Loading the official receipt.",
      });
      await loadReceiptUnlocked();
      return;
    }
    if (resolution.status === "prepared") {
      patch({
        stage: "cash",
        message: "Enter cash received. The server verifies the tender.",
        transactionId: resolution.transactionId,
      });
      return;
    }
    if (resolution.status === "payment_pending") {
      patch({
        stage: "resolving_payment",
        message: "A payment is already pending for this sale. Do not confirm cash again. Checking the existing tender.",
        transactionId: resolution.transactionId,
      });
      await resolvePaymentUnlocked();
      return;
    }
    if (resolution.status === "finalizing") {
      patch({
        stage: "finalizing",
        saleCompleted: false,
        transactionId: resolution.transactionId,
        message: "Finalizing the sale. Payment has been submitted; do not charge again.",
      });
      if (paymentId) {
        await finalizeUnlocked();
      }
      return;
    }
    if (resolution.status === "requires_attention") {
      patch({
        stage: "finalize_failed",
        message: resolution.message ?? "This transaction needs manager review. Do not start another sale.",
        transactionId: resolution.transactionId,
      });
      return;
    }
    if (resolution.status === "cancelled" || resolution.status === "not_found") {
      patch({
        stage: "prepare_failed",
        message: resolution.message ?? "The previous sale attempt was not found. The cart is unchanged.",
        prepared: undefined,
      });
      identities = null;
      return;
    }
    patch({
      stage: "resolving_sale",
      message: resolution.message ?? "Sale status is still uncertain. Do not start another sale.",
      transactionId: resolution.transactionId,
    });
  }

  async function resolvePaymentUnlocked(): Promise<void> {
    if (!identities) {
      return;
    }
    patch({
      stage: "resolving_payment",
      message: "Payment status is uncertain. Do not confirm cash again. Checking the existing tender.",
      inputError: undefined,
    });
    const outcome = await settle(() =>
      ports.payments.resolve({
        transactionId: identities!.transactionId,
        paymentId,
      }),
    );
    if (outcome.kind === "unknown") {
      patch({
        stage: "resolving_payment",
        message: outcome.message,
      });
      return;
    }
    if (!outcome.value.ok) {
      patch({
        stage: "resolving_payment",
        message: outcome.value.error.message,
      });
      return;
    }
    await applyPaymentState(outcome.value.data);
  }

  async function applyPaymentState(state: PaymentState): Promise<void> {
    paymentId = state.paymentId;
    if (paymentVerified(state)) {
      patch({
        stage: "finalizing",
        message: "Finalizing the sale. Payment has been submitted; do not charge again.",
        inputError: undefined,
      });
      await finalizeUnlocked();
      return;
    }
    if (paymentAllowsCashRetry(state)) {
      patch({
        stage: "cash_failed",
        message: "Cash was not confirmed. The cart is unchanged. Retry uses the same payment attempt.",
      });
      return;
    }
    if (paymentNeedsResolve(state) || state.nextAction === "present_payment") {
      patch({
        stage: "resolving_payment",
        message:
          state.nextAction === "present_payment"
            ? "A payment is already in progress. Do not confirm cash again. Check payment status."
            : "Payment status is uncertain. Do not confirm cash again. Checking the existing tender.",
      });
      return;
    }
    patch({
      stage: "resolving_payment",
      message: "This payment needs review. Do not confirm cash again.",
    });
  }

  async function finalizeUnlocked(): Promise<void> {
    const attempt = identities;
    const verifiedPaymentId = paymentId;
    if (!attempt || !verifiedPaymentId) {
      patch({
        stage: "finalize_failed",
        message: "A verified payment is required before the sale can be finalized.",
      });
      return;
    }
    patch({
      stage: "finalizing",
      message: "Finalizing the sale. Payment has been submitted; do not charge again.",
    });
    const outcome = await settle(() =>
      ports.checkout.finalize(
        { transactionId: attempt.transactionId, paymentId: verifiedPaymentId },
        attempt.finalize,
      ),
    );
    if (outcome.kind === "unknown" || (outcome.kind === "result" && !outcome.value.ok && shouldResolveFailure(outcome.value))) {
      await resolveSaleUnlocked();
      return;
    }
    if (outcome.kind === "result" && outcome.value.ok) {
      await applySaleResolution(outcome.value.data);
      return;
    }
    if (outcome.kind === "result" && !outcome.value.ok) {
      patch({
        stage: "finalize_failed",
        message: outcome.value.error.message,
      });
    }
  }

  async function loadReceiptUnlocked(): Promise<void> {
    if (!identities) {
      return;
    }
    const outcome = await settle(() => ports.receipts.getByTransaction(identities!.transactionId));
    if (outcome.kind === "unknown") {
      patch({
        stage: "receipt_failed",
        saleCompleted: true,
        receipt: undefined,
        message: outcome.message,
      });
      return;
    }
    if (!outcome.value.ok) {
      patch({
        stage: "receipt_failed",
        saleCompleted: true,
        receipt: undefined,
        message: outcome.value.error.message,
      });
      return;
    }
    patch({
      stage: "receipt_ready",
      saleCompleted: true,
      receipt: mapReceiptSnapshot(outcome.value.data),
      message: "The sale is complete.",
      printStatus: "idle",
    });
  }

  async function printUnlocked(reason: "initial" | "reprint"): Promise<void> {
    const receipt = session.receipt;
    if (!receipt) {
      return;
    }
    patch({
      stage: "printing",
      printStatus: "printing",
      printMessage: undefined,
      message: "Sending the receipt to the printer.",
    });
    try {
      const result = await ports.printer.print({ receiptId: receipt.id, reason });
      printAttempted = true;
      if (result.status === "dialog_opened") {
        patch({
          stage: "receipt_ready",
          printStatus: "dialog_opened",
          printMessage: result.message ?? "Print dialog opened.",
          message: "The sale is complete.",
        });
        return;
      }
      patch({
        stage: "print_failed",
        printStatus: result.status,
        printMessage: result.message ?? "Printing failed. The sale remains complete.",
        message: result.message ?? "Printing failed. The sale remains complete.",
      });
    } catch (error) {
      printAttempted = true;
      patch({
        stage: "print_failed",
        printStatus: "failed",
        printMessage: error instanceof Error ? error.message : "Printing failed. The sale remains complete.",
        message: "Printing failed. The sale remains complete.",
      });
    }
  }

  return {
    getSession(): CheckoutSessionView {
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
    async startPrepare(quote: Quote | undefined): Promise<void> {
      if (commandLock || session.saleCompleted) {
        return;
      }
      if (!quote || !quote.purchasable) {
        return;
      }
      if (session.prepared && !session.saleCompleted) {
        if (identities && quoteMatches(identities, quote) && (session.stage === "idle" || session.stage === "cash" || session.stage === "cash_failed")) {
          patch({
            stage: session.stage === "cash_failed" ? "cash_failed" : "cash",
            message:
              session.stage === "cash_failed"
                ? session.message
                : "Enter cash received. The server verifies the tender.",
            inputError: undefined,
          });
        }
        return;
      }
      if (session.stage !== "idle" && session.stage !== "prepare_failed") {
        return;
      }
      commandLock = true;
      const attempt = identitiesFor(quote);
      patch({
        stage: "preparing",
        message: "Preparing order. Rechecking price and stock before money is accepted.",
        inputError: undefined,
        receipt: undefined,
        transactionId: attempt.transactionId,
        saleCompleted: false,
      });
      try {
        const outcome = await settle(() =>
          ports.checkout.prepare(
            {
              transactionId: attempt.transactionId,
              registerId: ports.scope.registerId,
              shiftId: ports.scope.shiftId,
              deviceId: ports.scope.deviceId,
              quoteId: quote.id,
              quoteFingerprint: quote.fingerprint,
            },
            attempt.prepare,
          ),
        );
        if (outcome.kind === "unknown" || (outcome.kind === "result" && !outcome.value.ok && shouldResolveFailure(outcome.value))) {
          await resolveSaleUnlocked();
          return;
        }
        if (outcome.kind === "result" && outcome.value.ok) {
          patch({
            stage: "cash",
            prepared: mapPrepared(outcome.value.data),
            transactionId: outcome.value.data.transactionId,
            message: "Enter cash received. The server verifies the tender.",
          });
          return;
        }
        if (outcome.kind === "result" && !outcome.value.ok) {
          patch({
            stage: "prepare_failed",
            message: outcome.value.error.message,
            prepared: undefined,
          });
        }
      } finally {
        commandLock = false;
        notify();
      }
    },
    async resolveSale(): Promise<void> {
      if (commandLock) {
        return;
      }
      commandLock = true;
      try {
        await resolveSaleUnlocked();
      } finally {
        commandLock = false;
        notify();
      }
    },
    async confirmCash(cashReceivedText: string): Promise<void> {
      if (commandLock || session.saleCompleted) {
        return;
      }
      if (session.stage !== "cash" && session.stage !== "cash_failed") {
        return;
      }
      if (!identities) {
        return;
      }
      const attempt = identities;
      const parsed = parseDecimalToMinorUnits(cashReceivedText, { emptyMessage: "Enter the cash received." });
      if (!parsed.ok) {
        patch({ inputError: parsed.message });
        return;
      }
      commandLock = true;
      patch({
        stage: "confirming_cash",
        message: "Confirming cash payment. Do not send another tender.",
        inputError: undefined,
      });
      try {
        const outcome = await settle(() =>
          ports.payments.confirmCash(
            {
              transactionId: attempt.transactionId,
              cashReceived: {
                minor: parsed.minor,
                currency: session.prepared?.total.currency ?? attempt.currency,
              },
            },
            attempt.cash,
          ),
        );
        if (outcome.kind === "unknown" || (outcome.kind === "result" && !outcome.value.ok && shouldResolveFailure(outcome.value))) {
          await resolvePaymentUnlocked();
          return;
        }
        if (outcome.kind === "result" && outcome.value.ok) {
          await applyPaymentState(outcome.value.data);
          return;
        }
        if (outcome.kind === "result" && !outcome.value.ok) {
          patch({
            stage: "cash_failed",
            message: outcome.value.error.message,
          });
        }
      } finally {
        commandLock = false;
        notify();
      }
    },
    async resolvePayment(): Promise<void> {
      if (commandLock) {
        return;
      }
      commandLock = true;
      try {
        await resolvePaymentUnlocked();
      } finally {
        commandLock = false;
        notify();
      }
    },
    async retryFinalize(): Promise<void> {
      if (commandLock || !paymentId) {
        return;
      }
      commandLock = true;
      try {
        await finalizeUnlocked();
      } finally {
        commandLock = false;
        notify();
      }
    },
    async loadReceipt(): Promise<void> {
      if (commandLock || !session.saleCompleted) {
        return;
      }
      commandLock = true;
      try {
        await loadReceiptUnlocked();
      } finally {
        commandLock = false;
        notify();
      }
    },
    async printReceipt(): Promise<void> {
      if (commandLock || !session.receipt) {
        return;
      }
      commandLock = true;
      try {
        await printUnlocked(printAttempted ? "reprint" : "initial");
      } finally {
        commandLock = false;
        notify();
      }
    },
    dismiss(): void {
      if (commandLock) {
        return;
      }
      if (!checkoutDismissAllowed(session)) {
        return;
      }
      identities = null;
      paymentId = undefined;
      patch({
        stage: "idle",
        message: "",
        inputError: undefined,
        prepared: undefined,
        transactionId: undefined,
      });
    },
    resetForNewSale(): void {
      if (!canBeginNewSale(session)) {
        return;
      }
      identities = null;
      paymentId = undefined;
      printAttempted = false;
      commandLock = false;
      setSession(idleCheckoutSession());
    },
  };
}

export type CashCheckoutController = ReturnType<typeof createCashCheckoutController>;
