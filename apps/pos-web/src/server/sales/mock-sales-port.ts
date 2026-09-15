import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type {
  BridgeFinalizeRequest,
  CommandContext,
  PreparedSale,
  PrepareSaleRequest,
  Quote,
  SaleResolution,
} from "../../../../../docs/contracts/domain.generated";
import { apiFailure } from "../http/api-failure";

/**
 * Local commercial adapter when no bridge identity is configured.
 * CORE-05 orchestration tests inject this mock and seed POS sales directly.
 * CORE-06 combined proof uses `createInstrumentedBridgeSalesPort`.
 * `composeCheckoutRuntime` uses the quote-snapshot variant so local prepare
 * cannot invent a zero total against a stored authoritative quote.
 */
export type MockSalesPort = Pick<SalesPort, "prepare" | "resolve" | "confirmPayment"> & {
  commercialSaleCount: number;
  prepareCount: number;
  failNextConfirm: boolean;
  readonly confirmedTransactionIds: ReadonlySet<string>;
};

type QuoteLookup = {
  getQuote(quoteId: Quote["id"]): Promise<Quote | undefined>;
};

export function createMockSalesPort(): MockSalesPort {
  return createSalesPortFromQuotes(undefined);
}

/** Local/dev SalesPort: PreparedSale.total comes from the stored quote snapshot. */
export function createQuoteSnapshotSalesPort(quotes: QuoteLookup): MockSalesPort {
  return createSalesPortFromQuotes(quotes);
}

function createSalesPortFromQuotes(quotes: QuoteLookup | undefined): MockSalesPort {
  const prepared = new Map<string, PreparedSale>();
  const confirmed = new Map<string, SaleResolution>();
  const port: MockSalesPort = {
    commercialSaleCount: 0,
    prepareCount: 0,
    failNextConfirm: false,
    get confirmedTransactionIds() {
      return new Set(confirmed.keys());
    },
    async prepare(input: PrepareSaleRequest, context: CommandContext): Promise<ApiResult<PreparedSale>> {
      const existing = prepared.get(input.transactionId);
      if (existing) {
        return { ok: true, data: existing, correlationId: context.correlationId };
      }
      const quote = quotes ? await quotes.getQuote(input.quoteId) : undefined;
      if (quotes && !quote) {
        return apiFailure("NOT_FOUND", "Quote snapshot was not found", context.correlationId);
      }
      if (quote && quote.fingerprint !== input.quoteFingerprint) {
        return apiFailure("QUOTE_CHANGED", "quoteFingerprint does not match the stored quote", context.correlationId);
      }
      port.prepareCount += 1;
      const sale: PreparedSale = {
        transactionId: input.transactionId,
        saleId: `woo-mock-${port.prepareCount}`,
        orderReference: `woo-mock-${port.prepareCount}`,
        quoteFingerprint: input.quoteFingerprint,
        total: quote?.total ?? { minor: 0, currency: "GHS" },
        status: "prepared",
        stockCommitment: "reserved",
        preparedAt: quote?.calculatedAt ?? "2026-09-15T00:00:00.000Z",
        expiresAt: quote?.expiresAt ?? "2099-01-01T00:00:00.000Z",
      };
      prepared.set(input.transactionId, sale);
      return { ok: true, data: sale, correlationId: context.correlationId };
    },
    async resolve(transactionId): Promise<ApiResult<SaleResolution>> {
      const correlationId = "00000000-0000-4000-8000-000000000000";
      const completed = confirmed.get(transactionId);
      if (completed) {
        return { ok: true, data: completed, correlationId };
      }
      const sale = prepared.get(transactionId);
      if (sale) {
        return {
          ok: true,
          data: {
            transactionId,
            status: "prepared",
            saleId: sale.saleId,
            orderReference: sale.orderReference,
          },
          correlationId,
        };
      }
      return {
        ok: true,
        data: { transactionId, status: "not_found" },
        correlationId,
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
  };
  return port;
}
