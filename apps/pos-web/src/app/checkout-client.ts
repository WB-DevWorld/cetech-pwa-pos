import type {
  ApiResult,
  CheckoutUseCases,
  PaymentPort,
  PrintPort,
  ReceiptPort,
  RegisterPort,
  ReturnPort,
  SalesPort,
} from "../../../../docs/contracts/ports";
import type {
  CancelSaleRequest,
  CashPaymentRequest,
  CloseShiftRequest,
  CommandContext,
  FinalizeSaleRequest,
  InitializePaymentRequest,
  OpenShiftRequest,
  PaymentLookup,
  PaymentState,
  PreparedSale,
  PrepareSaleRequest,
  PrintResult,
  ReceiptSnapshot,
  Register,
  ReturnExecuteRequest,
  ReturnPreview,
  ReturnPreviewRequest,
  ReturnResolution,
  SaleResolution,
  Shift,
  ShiftReport,
  Uuid,
} from "../../../../docs/contracts/domain.generated";
import type { CashCheckoutPorts, CashCheckoutScope } from "../features/sell";

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

export function createBrowserCheckoutUseCases(options: BrowserCheckoutOptions = {}): CheckoutUseCases {
  return {
    prepare(input: PrepareSaleRequest, context: CommandContext): Promise<ApiResult<PreparedSale>> {
      return command("/api/pos/v1/sales/prepare", "POST", context, options, input);
    },
    finalize(input: FinalizeSaleRequest, context: CommandContext): Promise<ApiResult<SaleResolution>> {
      return command("/api/pos/v1/sales/finalize", "POST", context, options, input);
    },
  };
}

export function createBrowserPaymentPort(
  options: BrowserCheckoutOptions = {},
): Pick<PaymentPort, "initialize" | "confirmCash" | "resolve"> {
  return {
    initialize(input: InitializePaymentRequest, context: CommandContext): Promise<ApiResult<PaymentState>> {
      return command("/api/pos/v1/payments/initialize", "POST", context, options, input);
    },
    confirmCash(input: CashPaymentRequest, context: CommandContext): Promise<ApiResult<PaymentState>> {
      return command("/api/pos/v1/payments/cash", "POST", context, options, input);
    },
    resolve(input: PaymentLookup): Promise<ApiResult<PaymentState>> {
      return command("/api/pos/v1/payments/resolve", "POST", { correlationId: crypto.randomUUID() }, options, input);
    },
  };
}

export function createBrowserSalesResolvePort(options: BrowserCheckoutOptions = {}): Pick<SalesPort, "resolve" | "cancel"> {
  return {
    resolve(transactionId: Uuid): Promise<ApiResult<SaleResolution>> {
      return command(`/api/pos/v1/sales/${transactionId}`, "GET", { correlationId: crypto.randomUUID() }, options);
    },
    cancel(input: CancelSaleRequest, context: CommandContext): Promise<ApiResult<SaleResolution>> {
      return command("/api/pos/v1/sales/cancel", "POST", context, options, input);
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

export function createBrowserReturnPort(options: BrowserCheckoutOptions = {}): ReturnPort {
  return {
    preview(input: ReturnPreviewRequest): Promise<ApiResult<ReturnPreview>> {
      return command("/api/pos/v1/returns/preview", "POST", { correlationId: crypto.randomUUID() }, options, input);
    },
    execute(input: ReturnExecuteRequest, context: CommandContext): Promise<ApiResult<ReturnResolution>> {
      return command("/api/pos/v1/returns/execute", "POST", context, options, input);
    },
    resolve(returnId: Uuid): Promise<ApiResult<ReturnResolution>> {
      return command(`/api/pos/v1/returns/${returnId}`, "GET", { correlationId: crypto.randomUUID() }, options);
    },
  };
}

export function createBrowserRegisterPort(options: BrowserCheckoutOptions = {}): RegisterPort {
  return {
    get(id): Promise<ApiResult<Register>> {
      return command(`/api/pos/v1/registers/${id}`, "GET", { correlationId: crypto.randomUUID() }, options);
    },
    activeShift(id): Promise<ApiResult<Shift | null>> {
      return command(`/api/pos/v1/registers/${id}/active-shift`, "GET", { correlationId: crypto.randomUUID() }, options);
    },
    open(input: OpenShiftRequest, context: CommandContext): Promise<ApiResult<Shift>> {
      return command("/api/pos/v1/shifts/open", "POST", context, options, input);
    },
    cashMovement() {
      return Promise.resolve(
        unavailable(crypto.randomUUID(), "Cash movements are not mounted in this R8 composition."),
      );
    },
    close(input: CloseShiftRequest, context: CommandContext): Promise<ApiResult<Shift>> {
      return command("/api/pos/v1/shifts/close", "POST", context, options, input);
    },
    report(shiftId: Uuid, kind: "X" | "Z"): Promise<ApiResult<ShiftReport>> {
      return command(
        `/api/pos/v1/shifts/${shiftId}/report?kind=${kind}`,
        "GET",
        { correlationId: crypto.randomUUID() },
        options,
      );
    },
  };
}
