import type {
  CashMovement,
  CustomerContext,
  Id,
  Money,
  PendingOperation,
  PreparedSale,
  ReceiptLine,
  ReceiptSnapshot,
  Register,
  SaleStatus,
  Quote,
  Session,
  Shift,
  Timestamp,
  Uuid,
  VerifiedPaymentEvidence,
} from "../../../../../docs/contracts/domain.generated";

export type StaffActor = Pick<Session, "actorId" | "displayName" | "organizationId" | "locationIds">;

export type StoredRegister = Register & {
  readonly organizationId: Id;
};

export type StoredDevice = {
  readonly id: Uuid;
  readonly organizationId: Id;
  readonly locationId: Id;
  readonly status: "active" | "inactive";
};

export type StoredShift = Shift & {
  readonly organizationId: Id;
  readonly locationId: Id;
};

export type StoredCashMovement = CashMovement & {
  readonly organizationId: Id;
};

export type StoredPayment = {
  readonly paymentId: Uuid;
  readonly transactionId: Uuid;
  readonly saleId: Id;
  readonly evidenceId: Uuid;
  readonly tender: "cash";
  readonly status: "verified";
  readonly amount: Money;
  readonly cashReceived: Money;
  readonly verifiedAt: Timestamp;
  readonly verificationSource: "cash_ledger";
  readonly actorId: Id;
};

export type PosSaleRecord = {
  readonly organizationId: Id;
  readonly locationId: Id;
  readonly locationName: string;
  readonly registerId: Id;
  readonly registerName: string;
  readonly deviceId: Uuid;
  readonly shiftId: Uuid;
  readonly cashierId: Id;
  readonly cashierName: string;
  readonly customer: CustomerContext;
  readonly customerLabel: string;
  readonly prepared: PreparedSale;
  readonly lines: readonly ReceiptLine[];
  readonly subtotal: Money;
  readonly discount: Money;
  readonly tax: Money;
  status: SaleStatus;
  assignedPaymentId?: Uuid;
  commercialConfirmed: boolean;
  receipt?: ReceiptSnapshot;
};

export type OutboxEvent = {
  readonly id: Uuid;
  readonly organizationId: Id;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Readonly<Record<string, string>>;
  readonly createdAt: Timestamp;
  publishedAt?: Timestamp;
};

export type IdempotencyClaim =
  | { readonly kind: "acquired" }
  | { readonly kind: "in_progress" }
  | { readonly kind: "conflict" }
  | { readonly kind: "replay"; readonly outcome: unknown }
  | { readonly kind: "repair"; readonly outcome: unknown };

export type CommandScopeBinding = {
  readonly organizationId: Id;
  readonly locationId: Id;
  readonly registerId?: Id;
  readonly shiftId?: Uuid;
  readonly transactionId: Uuid;
  readonly operation: PendingOperation["operation"];
};

export type CommandScopeFields = {
  readonly registerId?: Id;
  readonly shiftId?: Uuid;
  readonly transactionId?: Uuid;
};

export type SeedPreparedSaleInput = {
  readonly organizationId: Id;
  readonly locationId: Id;
  readonly locationName: string;
  readonly registerId: Id;
  readonly registerName: string;
  readonly deviceId: Uuid;
  readonly shiftId: Uuid;
  readonly cashierId: Id;
  readonly cashierName: string;
  readonly customer: CustomerContext;
  readonly customerLabel: string;
  readonly prepared: PreparedSale;
  readonly lines: readonly ReceiptLine[];
  readonly subtotal: Money;
  readonly discount: Money;
  readonly tax: Money;
};

export interface CheckoutStore {
  seedRegister(register: StoredRegister): Promise<void>;
  seedDevice(device: StoredDevice): Promise<void>;
  getRegister(id: Id): Promise<StoredRegister | undefined>;
  getDevice(id: Uuid): Promise<StoredDevice | undefined>;
  getActiveShift(registerId: Id): Promise<StoredShift | undefined>;
  getShift(id: Uuid): Promise<StoredShift | undefined>;
  insertOpenShift(shift: StoredShift): Promise<"ok" | "conflict">;
  appendCashMovement(movement: StoredCashMovement): Promise<"ok" | "duplicate_sale" | "shift_required" | "negative_expected">;
  listCashSales(transactionId: Uuid): Promise<readonly StoredCashMovement[]>;
  expectedCash(shiftId: Uuid): Promise<Money | undefined>;
  saveQuote(quote: Quote): Promise<void>;
  getQuote(quoteId: Id): Promise<Quote | undefined>;
  seedPreparedSale(input: SeedPreparedSaleInput): Promise<PosSaleRecord>;
  getSale(transactionId: Uuid): Promise<PosSaleRecord | undefined>;
  saveSale(sale: PosSaleRecord): Promise<void>;
  getPayment(paymentId: Uuid): Promise<StoredPayment | undefined>;
  getPaymentForTransaction(transactionId: Uuid): Promise<StoredPayment | undefined>;
  savePayment(payment: StoredPayment): Promise<void>;
  getReceipt(transactionId: Uuid): Promise<ReceiptSnapshot | undefined>;
  saveReceipt(receipt: ReceiptSnapshot): Promise<"ok" | "duplicate">;
  enqueueOutbox(event: OutboxEvent): Promise<void>;
  listOutbox(aggregateId: string): Promise<readonly OutboxEvent[]>;
  lookupCommandScope(input: {
    readonly transactionId: Uuid;
    readonly operation: PendingOperation["operation"];
  }): Promise<CommandScopeBinding | undefined>;
  claimIdempotency(
    organizationId: Id,
    operation: PendingOperation["operation"],
    idempotencyKey: Uuid,
    requestHash: string,
    locationId?: Id,
    scope?: CommandScopeFields,
  ): Promise<IdempotencyClaim>;
  markIdempotencySent(organizationId: Id, operation: PendingOperation["operation"], idempotencyKey: Uuid): Promise<void>;
  acknowledgeIdempotency(
    organizationId: Id,
    operation: PendingOperation["operation"],
    idempotencyKey: Uuid,
    outcome: unknown,
  ): Promise<void>;
  markIdempotencyRequiresAttention(
    organizationId: Id,
    operation: PendingOperation["operation"],
    idempotencyKey: Uuid,
    outcome: unknown,
  ): Promise<void>;
  releaseIdempotency(organizationId: Id, operation: PendingOperation["operation"], idempotencyKey: Uuid): Promise<void>;
  withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
  peekIdempotency(
    organizationId: Id,
    operation: PendingOperation["operation"],
    idempotencyKey: Uuid,
  ): Promise<PendingOperation["status"] | undefined>;
}

/**
 * Test-only persistence faults. Durable adapters must not carry process-local
 * fault switches as business semantics.
 */
export interface FaultInjectingCheckoutStore extends CheckoutStore {
  failNextReceiptWrite: boolean;
  failNextPaymentWrite: boolean;
  failNextSaleWrite: boolean;
  failNextCommercialConfirmedWrite: boolean;
  receiptWriteAttempts: number;
}

export function evidenceFromPayment(payment: StoredPayment): VerifiedPaymentEvidence {
  return {
    evidenceId: payment.evidenceId,
    transactionId: payment.transactionId,
    paymentId: payment.paymentId,
    saleId: payment.saleId,
    amount: payment.amount,
    tender: "cash",
    verifiedAt: payment.verifiedAt,
    verificationSource: "cash_ledger",
  };
}

export function moneyEqual(left: Money, right: Money): boolean {
  return left.minor === right.minor && left.currency === right.currency;
}

export function customerEqual(left: CustomerContext, right: CustomerContext): boolean {
  if (left.kind === "walkin" || right.kind === "walkin") {
    return left.kind === right.kind;
  }
  return left.kind === right.kind && left.customerId === right.customerId;
}
