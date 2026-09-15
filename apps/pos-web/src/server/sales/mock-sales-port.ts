import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type {
  BridgeFinalizeRequest,
  CancelSaleRequest,
  CommandContext,
  PrepareSaleRequest,
  PreparedSale,
  SaleResolution,
  Uuid,
} from "../../../../../docs/contracts/domain.generated";
import { apiFailure } from "../http/api-failure";

/**
 * Local/dev commercial finalizer mock. It implements the full SalesPort surface
 * so BFF composition stays type-stable, while only confirmPayment simulates a
 * completed commercial sale. Staging/production never select this adapter.
 */
export type MockSalesPort = SalesPort & {
  commercialSaleCount: number;
  failNextConfirm: boolean;
  readonly confirmedTransactionIds: ReadonlySet<string>;
};

export function createMockSalesPort(): MockSalesPort {
  const confirmed = new Map<string, SaleResolution>();
  const port: MockSalesPort = {
    commercialSaleCount: 0,
    failNextConfirm: false,
    get confirmedTransactionIds() {
      return new Set(confirmed.keys());
    },
    async prepare(
      _input: PrepareSaleRequest,
      context: CommandContext,
    ): Promise<ApiResult<PreparedSale>> {
      return apiFailure(
        "INTEGRATION_UNAVAILABLE",
        "local mock SalesPort does not implement Woo prepare",
        context.correlationId,
      );
    },
    async resolve(transactionId: Uuid): Promise<ApiResult<SaleResolution>> {
      const existing = confirmed.get(transactionId);
      return {
        ok: true,
        correlationId: crypto.randomUUID(),
        data: existing ?? { transactionId, status: "not_found" },
      };
    },
    async confirmPayment(
      input: BridgeFinalizeRequest,
      context: CommandContext,
    ): Promise<ApiResult<SaleResolution>> {
      if (port.failNextConfirm) {
        port.failNextConfirm = false;
        return apiFailure(
          "INTEGRATION_UNAVAILABLE",
          "commercial finalizer is unavailable",
          context.correlationId,
        );
      }
      const existing = confirmed.get(input.transactionId);
      if (existing) {
        return { ok: true, data: existing, correlationId: context.correlationId };
      }
      port.commercialSaleCount += 1;
      const resolution: SaleResolution = {
        transactionId: input.transactionId,
        status: "completed",
        saleId: input.payment.saleId,
        paymentId: input.payment.paymentId,
      };
      confirmed.set(input.transactionId, resolution);
      return { ok: true, data: resolution, correlationId: context.correlationId };
    },
    async cancel(input: CancelSaleRequest, context: CommandContext): Promise<ApiResult<SaleResolution>> {
      if (confirmed.has(input.transactionId)) {
        return apiFailure(
          "REQUIRES_ATTENTION",
          "local mock cannot cancel a commercially completed sale",
          context.correlationId,
        );
      }
      return {
        ok: true,
        correlationId: context.correlationId,
        data: { transactionId: input.transactionId, status: "cancelled" },
      };
    },
  };
  return port;
}
