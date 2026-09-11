/** Canonical application boundaries v1.0.0. No runtime implementations. */
import type * as D from './domain.generated';
export type ApiSuccess<T> = { readonly ok: true; readonly data: T; readonly correlationId: D.Uuid };
export type ApiResult<T> = ApiSuccess<T> | D.ApiFailure;
export interface CatalogPort {
  search(input: { query?: string; barcode?: string; productId?: D.Id; parentId?: D.Id; cursor?: string; limit?: number }): Promise<ApiResult<D.CatalogPage>>;
}
export interface CustomerPort { search(query: string): Promise<ApiResult<ReadonlyArray<D.CustomerSummary>>>; }
export interface PricingPort { quote(input: D.QuoteRequest): Promise<ApiResult<D.Quote>>; }
export interface SalesPort {
  prepare(input: D.PrepareSaleRequest, context: D.CommandContext): Promise<ApiResult<D.PreparedSale>>;
  resolve(transactionId: D.Uuid): Promise<ApiResult<D.SaleResolution>>;
  /** Server-only: evidence must be loaded/validated by FinalizeSale, never trusted from UI. */
  confirmPayment(input: D.BridgeFinalizeRequest, context: D.CommandContext): Promise<ApiResult<D.SaleResolution>>;
  cancel(input: D.CancelSaleRequest, context: D.CommandContext): Promise<ApiResult<D.SaleResolution>>;
}
export interface PaymentPort {
  initialize(input: D.InitializePaymentRequest, context: D.CommandContext): Promise<ApiResult<D.PaymentState>>;
  confirmCash(input: D.CashPaymentRequest, context: D.CommandContext): Promise<ApiResult<D.PaymentState>>;
  resolve(input: D.PaymentLookup): Promise<ApiResult<D.PaymentState>>;
  /** Server-only; approved commercial refund amount, never client-invented. */
  refund(input: D.RefundRequest, context: D.CommandContext): Promise<ApiResult<D.RefundState>>;
}
export interface CheckoutUseCases {
  prepare(input: D.PrepareSaleRequest, context: D.CommandContext): Promise<ApiResult<D.PreparedSale>>;
  finalize(input: D.FinalizeSaleRequest, context: D.CommandContext): Promise<ApiResult<D.SaleResolution>>;
}
export interface ReceiptPort { getByTransaction(id: D.Uuid): Promise<ApiResult<D.ReceiptSnapshot>>; }
export interface PrintPort { print(input: D.PrintRequest): Promise<D.PrintResult>; }
export interface RegisterPort {
  get(id: D.Id): Promise<ApiResult<D.Register>>;
  activeShift(id: D.Id): Promise<ApiResult<D.Shift | null>>;
  open(input: D.OpenShiftRequest, context: D.CommandContext): Promise<ApiResult<D.Shift>>;
  cashMovement(input: D.CashMovementRequest, context: D.CommandContext): Promise<ApiResult<D.CashMovement>>;
  close(input: D.CloseShiftRequest, context: D.CommandContext): Promise<ApiResult<D.Shift>>;
  report(shiftId: D.Uuid, kind: 'X' | 'Z'): Promise<ApiResult<D.ShiftReport>>;
}
export interface ReturnPort {
  preview(input: D.ReturnPreviewRequest): Promise<ApiResult<D.ReturnPreview>>;
  execute(input: D.ReturnExecuteRequest, context: D.CommandContext): Promise<ApiResult<D.ReturnResolution>>;
  resolve(returnId: D.Uuid): Promise<ApiResult<D.ReturnResolution>>;
}
export interface IdentityPort {
  getSession(): Promise<ApiResult<D.Session>>;
  can(capability: string): Promise<boolean>; // UI hint; server rechecks every command.
  signOut(): Promise<void>;
}
export interface HealthPort { getStoreHealth(): Promise<ApiResult<D.StoreHealth>>; }
export interface CartDraftStore { save(input: D.CartDraft): Promise<void>; load(cartId: D.Uuid): Promise<D.CartDraft | null>; }
export interface OperationJournal {
  appendBeforeSend(operation: D.PendingOperation, versionedCommandPayload: string): Promise<void>;
  pending(): Promise<ReadonlyArray<D.PendingOperation>>;
  markSent(id: D.Uuid): Promise<void>;
  markResponseUnknown(id: D.Uuid): Promise<void>;
  markAcknowledged(id: D.Uuid): Promise<void>;
  markRequiresAttention(id: D.Uuid, reason: string): Promise<void>;
}
