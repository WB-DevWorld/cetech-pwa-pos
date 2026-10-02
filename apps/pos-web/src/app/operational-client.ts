import type { ApiResult } from "../../../../docs/contracts/ports";
import type { CustomerSummary, StoreHealth } from "../../../../docs/contracts/domain.generated";
import type { PaymentMethodCapabilities } from "../server/payments/method-capabilities";
import type { AttentionItemView } from "../ui/operational";
import type { OrderDetailView, OrderListItemView } from "../features/orders";
import type { CustomerReadItem } from "../features/customers/customerRead";

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

async function getJson<T>(path: string, fetchImpl?: typeof fetch): Promise<ApiResult<T>> {
  const correlation = crypto.randomUUID();
  try {
    const response = await (fetchImpl ?? fetch)(path, {
      method: "GET",
      credentials: "include",
      headers: {
        accept: "application/json",
        "x-correlation-id": correlation,
        "x-csrf-token": readCookie("cetech_pos_csrf") ?? "",
      },
    });
    return (await response.json()) as ApiResult<T>;
  } catch {
    return {
      ok: false,
      error: {
        code: "INTEGRATION_UNAVAILABLE",
        message: "request could not be reached",
        retryable: true,
        nextAction: "resolve",
      },
      correlationId: correlation,
    };
  }
}

export async function fetchPaymentMethodCapabilities(
  fetchImpl?: typeof fetch,
): Promise<ApiResult<PaymentMethodCapabilities>> {
  return getJson<PaymentMethodCapabilities>("/api/pos/v1/payments/capabilities", fetchImpl);
}

export async function fetchStoreHealth(fetchImpl?: typeof fetch): Promise<ApiResult<StoreHealth>> {
  return getJson<StoreHealth>("/api/pos/v1/health", fetchImpl);
}

export type RegisterClosePresentation = {
  readonly showClose: boolean;
  readonly notice: string;
};

export async function fetchRegisterClosePresentation(
  registerId: string,
  fetchImpl?: typeof fetch,
): Promise<ApiResult<RegisterClosePresentation>> {
  return getJson<RegisterClosePresentation>(
    `/api/pos/v1/registers/${encodeURIComponent(registerId)}/close-presentation`,
    fetchImpl,
  );
}

export async function fetchOrderHistory(
  query: string,
  fetchImpl?: typeof fetch,
): Promise<ApiResult<{ readonly items: readonly OrderListItemView[] }>> {
  const encoded = encodeURIComponent(query);
  return getJson(`/api/pos/v1/orders${encoded ? `?q=${encoded}` : ""}`, fetchImpl);
}

export async function fetchOrderDetail(
  transactionId: string,
  fetchImpl?: typeof fetch,
): Promise<ApiResult<OrderDetailView>> {
  return getJson(`/api/pos/v1/orders/${encodeURIComponent(transactionId)}`, fetchImpl);
}

export async function fetchAttentionInbox(
  fetchImpl?: typeof fetch,
): Promise<ApiResult<{ readonly items: readonly AttentionItemView[]; readonly count: number }>> {
  return getJson("/api/pos/v1/attention", fetchImpl);
}

export async function fetchCustomerDirectory(
  query: string,
  fetchImpl?: typeof fetch,
): Promise<ApiResult<{ readonly items: readonly CustomerReadItem[] }>> {
  const encoded = encodeURIComponent(query);
  return getJson(`/api/pos/v1/customers${encoded ? `?q=${encoded}` : ""}`, fetchImpl);
}

export function toCustomerSummaries(
  items: readonly CustomerReadItem[],
): {
  readonly customers: readonly CustomerSummary[];
  readonly commercialContextById: Readonly<Record<string, string>>;
} {
  const commercialContextById: Record<string, string> = {};
  const customers = items.map((item) => {
    if (item.commercialContext) {
      commercialContextById[item.id] = item.commercialContext;
    }
    const { commercialContext, ...summary } = item;
    void commercialContext;
    return summary;
  });
  return { customers, commercialContextById };
}
