import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type {
  BridgeFinalizeRequest,
  CommandContext,
  SaleResolution,
} from "../../../../../docs/contracts/domain.generated";
import { apiFailure } from "../http/api-failure";

/**
 * CORE-05 commercial finalizer mock until BR-07. Idempotent per transaction:
 * a repair/retry does not create a second commercial sale.
 */
export type MockSalesPort = Pick<SalesPort, "confirmPayment"> & {
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
  };
  return port;
}
