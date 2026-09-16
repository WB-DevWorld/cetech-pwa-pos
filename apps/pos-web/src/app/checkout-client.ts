import type {
  ApiResult,
  CheckoutUseCases,
  PaymentPort,
  PrintPort,
  ReceiptPort,
  SalesPort,
} from "../../../../docs/contracts/ports";
import type {
  CashPaymentRequest,
  CommandContext,
  FinalizeSaleRequest,
  PaymentLookup,
  PaymentState,
  PreparedSale,
  PrepareSaleRequest,
  PrintResult,
  ReceiptSnapshot,
  SaleResolution,
  Uuid,
} from "../../../../docs/contracts/domain.generated";
import type { CashCheckoutPorts, CashCheckoutScope } from "../features/sell";
import type { TenderActivityPort } from "../local";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return null;
}

export const LOCAL_CHECKOUT_SCOPE: CashCheckoutScope = {
  registerId: "reg-front-1",
  shiftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  deviceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
};

type BrowserCheckoutOptions = {
  readonly fetchImpl?: typeof fetch;
  readonly csrfCookie?: string;
  readonly csrfHeader?: string;
  readonly origin?: string;
  readonly tenderActivity?: TenderActivityPort;
};

function unavailable<T>(correlation: Uuid, message: string): ApiResult<T> {
  return {
    ok: false,
    error: {
      code: "INTEGRATION_UNAVAILABLE",
      message,
      retryable: true,
      nextAction: "resolve",
    },
    correlationId: correlation,
  };
}

async function command<T>(
  url: string,
  method: "GET" | "POST",
  context: CommandContext | { correlationId: Uuid },
  options: BrowserCheckoutOptions,
  body?: unknown,
): Promise<ApiResult<T>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const csrfCookie = options.csrfCookie ?? "cetech_pos_csrf";
  const csrfHeader = options.csrfHeader ?? "x-csrf-token";
  const idempotencyKey = "idempotencyKey" in context ? context.idempotencyKey : undefined;
  try {
    const headers: Record<string, string> = {
      "x-correlation-id": context.correlationId,
      [csrfHeader]: readCookie(csrfCookie) ?? "",
    };
    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }
    if (idempotencyKey) {
      headers["idempotency-key"] = idempotencyKey;
    }
    const response = await fetchImpl(url, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await response.json()) as ApiResult<T>;
  } catch {
    return unavailable(context.correlationId, "Checkout transport failed. Resolve the existing operation.");
  }
}

function saleTerminal(result: ApiResult<SaleResolution>): boolean {
  return result.ok && (result.data.status === "completed" || result.data.status === "cancelled");
}

export function createBrowserCheckoutUseCases(options: BrowserCheckoutOptions = {}): CheckoutUseCases {
  return {
    async prepare(input: PrepareSaleRequest, context: CommandContext): Promise<ApiResult<PreparedSale>> {
      const result = await command<PreparedSale>("/api/pos/v1/sales/prepare", "POST", context, options, input);
      if (result.ok) {
        await options.tenderActivity?.markActive(input.transactionId);
      }
      return result;
    },
    async finalize(input: FinalizeSaleRequest, context: CommandContext): Promise<ApiResult<SaleResolution>> {
      await options.tenderActivity?.markActive(input.transactionId);
      const result = await command<SaleResolution>("/api/pos/v1/sales/finalize", "POST", context, options, input);
      if (saleTerminal(result)) {
        await options.tenderActivity?.clear(input.transactionId);
      }
      return result;
    },
  };
}

export function createBrowserPaymentPort(
  options: BrowserCheckoutOptions = {},
): Pick<PaymentPort, "confirmCash" | "resolve"> {
  return {
    async confirmCash(input: CashPaymentRequest, context: CommandContext): Promise<ApiResult<PaymentState>> {
      await options.tenderActivity?.markActive(input.transactionId);
      return command("/api/pos/v1/payments/cash", "POST", context, options, input);
    },
    async resolve(input: PaymentLookup): Promise<ApiResult<PaymentState>> {
      await options.tenderActivity?.markActive(input.transactionId);
      return command("/api/pos/v1/payments/resolve", "POST", { correlationId: crypto.randomUUID() }, options, input);
    },
  };
}

export function createBrowserSalesResolvePort(options: BrowserCheckoutOptions = {}): Pick<SalesPort, "resolve"> {
  return {
    async resolve(transactionId: Uuid): Promise<ApiResult<SaleResolution>> {
      const result = await command<SaleResolution>(
        `/api/pos/v1/sales/${transactionId}`,
        "GET",
        { correlationId: crypto.randomUUID() },
        options,
      );
      if (saleTerminal(result)) {
        await options.tenderActivity?.clear(transactionId);
      } else if (result.ok) {
        await options.tenderActivity?.markActive(transactionId);
      }
      return result;
    },
  };
}

export function createBrowserReceiptPort(options: BrowserCheckoutOptions = {}): ReceiptPort {
  return {
    getByTransaction(id: Uuid): Promise<ApiResult<ReceiptSnapshot>> {
      return command(`/api/pos/v1/receipts/${id}`, "GET", { correlationId: crypto.randomUUID() }, options);
    },
  };
}

export function createBrowserPrintPort(): PrintPort {
  return {
    async print(): Promise<PrintResult> {
      if (typeof window === "undefined" || typeof window.print !== "function") {
        return { status: "unsupported", message: "Printing is not available in this session." };
      }
      window.print();
      return { status: "dialog_opened", message: "Print dialog opened." };
    },
  };
}

export function createBrowserCashCheckoutPorts(
  options: BrowserCheckoutOptions & { readonly scope?: CashCheckoutScope } = {},
): CashCheckoutPorts {
  return {
    checkout: createBrowserCheckoutUseCases(options),
    payments: createBrowserPaymentPort(options),
    sales: createBrowserSalesResolvePort(options),
    receipts: createBrowserReceiptPort(options),
    printer: createBrowserPrintPort(),
    scope: options.scope ?? LOCAL_CHECKOUT_SCOPE,
  };
}
