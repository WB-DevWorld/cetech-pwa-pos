/**
 * CETECH POS frontend/domain contracts.
 * Production-intent handoff: provider-neutral by design.
 * WooCommerce, WoodMart, B2BKing, Supabase, Paystack and other providers
 * belong in adapters/server infrastructure, not in these contracts.
 */

export type CurrencyCode = 'GHS' | (string & {});
export interface Money { readonly minor: number; readonly currency: CurrencyCode; }

export type ProductId = string;
export type VariationId = string;
export type CustomerId = string;
export type CartId = string;
export type CartLineId = string;
export type TransactionId = string;
export type PaymentId = string;
export type ReceiptId = string;
export type OrderId = string;
export type ReturnId = string;
export type RegisterId = string;
export type ShiftId = string;
export type DeviceId = string;
export type AttentionItemId = string;

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'backorder' | 'unknown';

export interface ProductVariation {
  readonly id: VariationId;
  readonly productId: ProductId;
  readonly sku?: string;
  readonly barcode?: string;
  readonly label: string;
  readonly attributes: Readonly<Record<string, string>>;
  /** Advisory catalog/display value only. */
  readonly displayPrice?: Money;
  /** Advisory projection. Hard stock validation belongs to SalesPort.prepare. */
  readonly availableQuantity?: number;
  readonly stockStatus: StockStatus;
}

export interface CatalogItem {
  readonly id: ProductId;
  readonly name: string;
  readonly shortName?: string;
  readonly sku?: string;
  readonly barcode?: string;
  readonly type: 'simple' | 'variable';
  readonly category?: string;
  /** Never treat this as the final customer/quantity-specific price. */
  readonly displayPrice?: Money;
  readonly regularDisplayPrice?: Money;
  readonly saleDisplayPrice?: Money;
  readonly stockStatus: StockStatus;
  readonly availableQuantity?: number;
  readonly projectionUpdatedAt?: string;
  readonly variations?: readonly ProductVariation[];
}

export type CustomerKind = 'walkin' | 'retail' | 'b2b';
export interface CustomerSummary {
  readonly id: CustomerId;
  readonly displayName: string;
  readonly company?: string;
  readonly kind: CustomerKind;
  readonly businessLabel?: string;
  readonly phoneMasked?: string;
}

export interface CustomerContext {
  readonly customer: CustomerSummary;
}

export interface CartLine {
  readonly id: CartLineId;
  readonly productId: ProductId;
  readonly variationId?: VariationId;
  readonly name: string;
  readonly variationLabel?: string;
  readonly sku?: string;
  readonly barcode?: string;
  readonly quantity: number;
  /** Fast visual hint before authoritative quote returns. */
  readonly displayUnitPrice?: Money;
}

export interface QuoteRequestLine {
  readonly lineId: CartLineId;
  readonly productId: ProductId;
  readonly variationId?: VariationId;
  readonly quantity: number;
}

export interface QuoteRequest {
  readonly cartId: CartId;
  readonly cartRevision: number;
  readonly customer: CustomerContext;
  readonly lines: readonly QuoteRequestLine[];
  readonly locationId?: string;
}

export interface QuoteProblem {
  readonly code:
    | 'PRODUCT_NOT_PURCHASABLE'
    | 'OUT_OF_STOCK'
    | 'MINIMUM_QUANTITY'
    | 'MAXIMUM_QUANTITY'
    | 'REQUIRED_MULTIPLE'
    | 'COMMERCIAL_RULE_VIOLATION'
    | 'PRICING_UNAVAILABLE';
  readonly lineId?: CartLineId;
  readonly message: string;
  readonly availableQuantity?: number;
  readonly requiredQuantity?: number;
}

export interface QuoteLine {
  readonly lineId: CartLineId;
  readonly productId: ProductId;
  readonly variationId?: VariationId;
  readonly quantity: number;
  readonly regularUnitPrice?: Money;
  readonly unitPrice: Money;
  readonly subtotal: Money;
  readonly discount: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly stockStatus: StockStatus;
  readonly availableQuantity?: number;
  readonly purchasable: boolean;
  /** Cashier-facing semantic explanation only. Never a plugin rule ID. */
  readonly pricingLabel?: 'Quantity pricing applied' | 'Wholesale pricing applied' | 'Customer price applied' | string;
  readonly problems?: readonly QuoteProblem[];
}

export interface CommerceQuote {
  readonly id: string;
  readonly fingerprint: string;
  readonly cartRevision: number;
  readonly customerContext: CustomerContext;
  readonly currency: CurrencyCode;
  readonly lines: readonly QuoteLine[];
  readonly subtotal: Money;
  readonly discount: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly calculatedAt: string;
  readonly expiresAt: string;
  readonly purchasable: boolean;
}

export type QuoteState =
  | { readonly status: 'missing' }
  | { readonly status: 'stale'; readonly previous?: CommerceQuote }
  | { readonly status: 'quoting'; readonly revision: number; readonly previous?: CommerceQuote }
  | { readonly status: 'confirmed'; readonly revision: number; readonly quote: CommerceQuote }
  | { readonly status: 'changed'; readonly revision: number; readonly previous: CommerceQuote; readonly current: CommerceQuote }
  | { readonly status: 'expired'; readonly previous: CommerceQuote }
  | { readonly status: 'failed'; readonly revision: number; readonly code: string; readonly message: string }
  | { readonly status: 'offline'; readonly previous?: CommerceQuote };

export interface CartDraft {
  readonly id: CartId;
  readonly revision: number;
  readonly customer: CustomerContext;
  readonly lines: readonly CartLine[];
  readonly quoteState: QuoteState;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type CheckoutBlockReason =
  | 'NO_ACTIVE_SHIFT'
  | 'CART_EMPTY'
  | 'QUOTE_REQUIRED'
  | 'QUOTE_STALE'
  | 'QUOTE_EXPIRED'
  | 'PRICING_UNAVAILABLE'
  | 'CONNECTION_REQUIRED'
  | 'PRODUCT_UNAVAILABLE'
  | 'CRITICAL_RECOVERY_PENDING'
  | 'PASSIVE_WINDOW'
  | 'UNSUPPORTED_APP_VERSION';

export type CheckoutEligibility =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: CheckoutBlockReason; readonly message: string };

export interface PrepareSaleCommand {
  readonly transactionId: TransactionId;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly registerId: RegisterId;
  readonly shiftId: ShiftId;
  readonly deviceId: DeviceId;
  readonly customer: CustomerContext;
  readonly lines: readonly QuoteRequestLine[];
  readonly quoteFingerprint: string;
}

export interface PreparedSale {
  readonly transactionId: TransactionId;
  readonly providerOrderId: string;
  readonly orderReference: string;
  readonly total: Money;
  readonly quoteFingerprint: string;
  readonly status: 'reserved';
  readonly preparedAt: string;
}

export type SaleResolutionStatus =
  | 'not_found'
  | 'reserved'
  | 'payment_pending'
  | 'completed'
  | 'cancelled'
  | 'requires_attention';

export interface SaleResolution {
  readonly transactionId: TransactionId;
  readonly providerOrderId?: string;
  readonly status: SaleResolutionStatus;
  readonly message?: string;
}

export type PaymentTender = 'cash' | 'mobile_money' | 'card' | 'external_electronic';

export type PaymentState =
  | { readonly status: 'not_started' }
  | { readonly status: 'initializing'; readonly tender: PaymentTender }
  | { readonly status: 'awaiting_customer'; readonly paymentId: PaymentId; readonly tender: PaymentTender; readonly reference?: string }
  | { readonly status: 'pending'; readonly paymentId: PaymentId; readonly tender: PaymentTender; readonly reference?: string }
  | { readonly status: 'verified'; readonly paymentId: PaymentId; readonly tender: PaymentTender; readonly reference?: string }
  | { readonly status: 'cancelled'; readonly paymentId?: PaymentId; readonly tender: PaymentTender }
  | { readonly status: 'failed'; readonly paymentId?: PaymentId; readonly tender: PaymentTender; readonly message: string }
  | { readonly status: 'reconciling'; readonly paymentId?: PaymentId; readonly tender: PaymentTender; readonly reference?: string }
  | { readonly status: 'finalizing'; readonly paymentId: PaymentId; readonly tender: PaymentTender }
  | { readonly status: 'completed'; readonly paymentId: PaymentId; readonly tender: PaymentTender }
  | { readonly status: 'requires_attention'; readonly paymentId?: PaymentId; readonly tender: PaymentTender; readonly message: string };

export interface ReceiptLineSnapshot {
  readonly name: string;
  readonly variationLabel?: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly total: Money;
}

export interface ReceiptSnapshot {
  readonly id: ReceiptId;
  readonly receiptNumber: string;
  readonly orderReference: string;
  readonly transactionId: TransactionId;
  readonly issuedAt: string;
  readonly locationName: string;
  readonly registerName: string;
  readonly cashierName: string;
  readonly customer: CustomerSummary;
  readonly lines: readonly ReceiptLineSnapshot[];
  readonly subtotal: Money;
  readonly discount: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly paymentTender: PaymentTender;
  readonly paymentReference?: string;
  readonly cashReceived?: Money;
  readonly changeDue?: Money;
  /** Keeps the ordinary POS receipt distinct from a statutory tax document. */
  readonly documentKind: 'operational_pos_receipt';
}

export interface OrderLineSummary {
  readonly id: string;
  readonly productId: ProductId;
  readonly variationId?: VariationId;
  readonly name: string;
  readonly quantity: number;
  readonly returnedQuantity: number;
  readonly unitPrice: Money;
  readonly total: Money;
}

export interface OrderSummary {
  readonly id: OrderId;
  readonly orderReference: string;
  readonly receiptNumber?: string;
  readonly transactionId?: TransactionId;
  readonly createdAt: string;
  readonly customer: CustomerSummary;
  readonly status: 'completed' | 'payment_pending' | 'cancelled' | 'partially_refunded' | 'refunded' | 'requires_attention';
  readonly paymentState: 'verified' | 'pending' | 'failed' | 'refunded' | 'requires_attention';
  readonly paymentTender?: PaymentTender;
  readonly paymentReference?: string;
  readonly total: Money;
  readonly lines: readonly OrderLineSummary[];
}

export type ReturnCondition = 'resellable' | 'opened_resellable' | 'damaged' | 'defective' | 'quarantine' | 'not_physically_returned';
export type ReturnReason = 'wrong_item' | 'customer_changed_mind' | 'defective' | 'damaged' | 'not_as_described' | 'incorrect_quantity' | 'warranty' | 'delivery_damage' | 'other';

export interface ReturnLine {
  readonly orderLineId: string;
  readonly quantity: number;
  readonly reason: ReturnReason;
  readonly condition: ReturnCondition;
  readonly refundAmount: Money;
  readonly restockQuantity: number;
}

export interface ReturnCase {
  readonly id: ReturnId;
  readonly orderId: OrderId;
  readonly status: 'draft' | 'previewed' | 'awaiting_approval' | 'approved' | 'refund_pending' | 'completed' | 'rejected' | 'requires_attention';
  readonly lines: readonly ReturnLine[];
  readonly refundTotal: Money;
  readonly refundTender?: PaymentTender;
  readonly initiatedBy: string;
  readonly approvedBy?: string;
  readonly createdAt: string;
  readonly completedAt?: string;
}

export interface Register {
  readonly id: RegisterId;
  readonly name: string;
  readonly code: string;
  readonly locationId: string;
  readonly status: 'active' | 'disabled' | 'maintenance';
  readonly currency: CurrencyCode;
}

export interface CashMovement {
  readonly id: string;
  readonly shiftId: ShiftId;
  readonly type: 'opening_float' | 'cash_sale' | 'cash_refund' | 'pay_in' | 'pay_out' | 'cash_pickup' | 'correction' | 'closing_adjustment';
  readonly amount: Money;
  readonly reason?: string;
  readonly createdBy: string;
  readonly approvedBy?: string;
  readonly createdAt: string;
}

export interface Shift {
  readonly id: ShiftId;
  readonly registerId: RegisterId;
  readonly deviceId: DeviceId;
  readonly cashierId: string;
  readonly status: 'opening' | 'open' | 'closing' | 'closed' | 'requires_attention';
  readonly openingFloat: Money;
  readonly expectedCash?: Money;
  readonly countedCash?: Money;
  readonly variance?: Money;
  readonly openedAt: string;
  readonly closedAt?: string;
}

export interface HealthCheck {
  readonly id: string;
  readonly label: string;
  readonly status: 'healthy' | 'degraded' | 'unavailable' | 'warning' | 'unsupported';
  readonly message: string;
  readonly updatedAt: string;
}

export interface StoreHealth {
  readonly online: boolean;
  readonly checks: readonly HealthCheck[];
  readonly pendingOperationCount: number;
  readonly attentionCount: number;
  readonly appBuildId: string;
  readonly localSchemaVersion: string;
  readonly apiContractVersion: string;
}

export interface AttentionItem {
  readonly id: AttentionItemId;
  readonly type: 'payment' | 'refund' | 'sale' | 'shift' | 'sync' | 'update' | 'local_data';
  readonly severity: 'info' | 'warning' | 'high' | 'critical';
  readonly title: string;
  readonly summary: string;
  readonly transactionId?: TransactionId;
  readonly status: 'open' | 'reviewed' | 'resolved';
  readonly createdAt: string;
}

export interface IdentitySession {
  readonly actorId: string;
  readonly displayName: string;
  readonly capabilities: readonly string[];
  readonly expiresAt?: string;
}

export interface CatalogPort {
  search(query: string, limit?: number): Promise<readonly CatalogItem[]>;
  findByBarcode(barcode: string): Promise<readonly { item: CatalogItem; variation?: ProductVariation }[]>;
  getProduct(id: ProductId): Promise<CatalogItem | null>;
}

export interface PricingPort { quote(request: QuoteRequest): Promise<CommerceQuote>; }

export interface CustomerPort {
  search(query: string): Promise<readonly CustomerSummary[]>;
  get(id: CustomerId): Promise<CustomerSummary | null>;
}

export interface SalesPort {
  prepare(command: PrepareSaleCommand): Promise<PreparedSale>;
  resolve(transactionId: TransactionId): Promise<SaleResolution>;
  cancel(input: { transactionId: TransactionId; reason: string }): Promise<SaleResolution>;
}

export interface PaymentPort {
  initialize(input: { transactionId: TransactionId; tender: PaymentTender }): Promise<PaymentState>;
  resolve(input: { transactionId: TransactionId; paymentId?: PaymentId }): Promise<PaymentState>;
  confirmCash(input: { transactionId: TransactionId; cashReceived: Money }): Promise<PaymentState>;
  cancel(input: { transactionId: TransactionId; paymentId?: PaymentId }): Promise<PaymentState>;
}

export interface ReceiptPort {
  getByTransaction(transactionId: TransactionId): Promise<ReceiptSnapshot | null>;
  reprint(receipt: ReceiptSnapshot): Promise<void>;
}

export interface RegisterPort {
  getRegister(id: RegisterId): Promise<Register>;
  getActiveShift(registerId: RegisterId): Promise<Shift | null>;
  openShift(input: { registerId: RegisterId; deviceId: DeviceId; openingFloat: Money }): Promise<Shift>;
  recordCashMovement(input: Omit<CashMovement, 'id' | 'createdAt'>): Promise<CashMovement>;
  getExpectedCash(shiftId: ShiftId): Promise<Money>;
  closeShift(input: { shiftId: ShiftId; countedCash: Money; managerApprovalId?: string }): Promise<Shift>;
}

export interface ReturnPort {
  preview(input: { orderId: OrderId; lines: readonly Pick<ReturnLine, 'orderLineId' | 'quantity' | 'reason' | 'condition'>[] }): Promise<ReturnCase>;
  execute(input: { returnId: ReturnId; approvalId?: string }): Promise<ReturnCase>;
  resolve(returnId: ReturnId): Promise<ReturnCase>;
}

export interface HealthPort { getStoreHealth(): Promise<StoreHealth>; }

export interface SyncPort {
  syncCatalog(): Promise<{ readonly status: 'completed' | 'failed'; readonly completedAt?: string }>;
  rebuildCatalogProjection(): Promise<{ readonly status: 'completed' | 'failed' }>;
}

export interface IdentityPort {
  getSession(): Promise<IdentitySession | null>;
  can(capability: string): Promise<boolean>;
  signOut(): Promise<void>;
}

/** Production local persistence ports. The zero-install preview uses temporary browser persistence only. */
export interface CartDraftStore {
  save(cart: CartDraft): Promise<void>;
  loadActive(): Promise<CartDraft | null>;
  remove(id: CartId): Promise<void>;
}

export interface PendingOperation {
  readonly id: string;
  readonly transactionId?: TransactionId;
  readonly type: 'sale.prepare' | 'sale.resolve' | 'payment.resolve' | 'refund.resolve' | 'shift.close';
  readonly idempotencyKey?: string;
  readonly status: 'pending' | 'sent' | 'response_unknown' | 'acknowledged' | 'requires_attention';
  readonly createdAt: string;
}

export interface OperationJournal {
  append(operation: PendingOperation): Promise<void>;
  pending(): Promise<readonly PendingOperation[]>;
  markAcknowledged(id: string): Promise<void>;
  markRequiresAttention(id: string, reason: string): Promise<void>;
}

export type AppBootMode = 'normal' | 'recovering' | 'degraded' | 'maintenance' | 'unsupported';
export type UpdateSafety = 'safe' | 'defer' | 'blocked_critical';

export interface ReleasePolicy {
  readonly latestBuild: string;
  readonly recommendedBuild: string;
  readonly minimumSupportedBuild: string;
  readonly criticalBuild?: string;
}
