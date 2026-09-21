"use client";

import { useEffect, useMemo } from "react";
import { ReturnsScreen, useReturnFlow, type HistoricSaleLookup } from "../features/returns";
import type { HistoricReturnSaleView } from "../features/returns/returnView";
import type { ReturnPort } from "../../../../docs/contracts/ports";
import { createBrowserReturnPort } from "./checkout-client";
import { fetchOrderHistory } from "./operational-client";

export function ReturnsRuntimeScreen({
  returns,
  lookup,
  initialSaleId,
  onSaleSelected,
}: {
  readonly returns: ReturnPort;
  readonly lookup?: HistoricSaleLookup;
  readonly initialSaleId?: string | null;
  readonly onSaleSelected?: (saleId: string) => void;
}) {
  const flow = useReturnFlow(useMemo(() => ({ returns }), [returns]));

  useEffect(() => {
    if (!initialSaleId || !lookup || !flow.controller) {
      return;
    }
    void lookup.search(initialSaleId).then((matches) => {
      const sale = matches.find((row) => row.saleId === initialSaleId || row.orderReference === initialSaleId);
      if (sale) {
        flow.controller?.selectSale(sale);
      }
    });
  }, [flow.controller, initialSaleId, lookup]);

  if (!flow.ready || !flow.controller) {
    return <p className="muted">Loading returns…</p>;
  }
  return (
    <ReturnsScreen
      session={flow.session}
      inFlight={flow.inFlight}
      lookup={lookup}
      onSelectSale={(sale) => {
        flow.controller?.selectSale(sale);
        onSaleSelected?.(sale.saleId);
      }}
      onUpdateLine={(orderLineId, patch) => flow.controller?.updateLine(orderLineId, patch)}
      onPreview={() => {
        void flow.controller?.preview();
      }}
      onExecute={() => {
        void flow.controller?.execute();
      }}
      onResolve={() => {
        void flow.controller?.resolve();
      }}
    />
  );
}

export function createProductionReturnRuntime(options?: { readonly fetchImpl?: typeof fetch }): {
  readonly returns: ReturnPort;
  readonly lookup: HistoricSaleLookup;
} {
  const returns = createBrowserReturnPort({ fetchImpl: options?.fetchImpl });
  return {
    returns,
    lookup: createBrowserHistoricReturnSaleLookup({ fetchImpl: options?.fetchImpl }),
  };
}

export function createBrowserHistoricReturnSaleLookup(
  options: { readonly fetchImpl?: typeof fetch } = {},
): HistoricSaleLookup {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async search(query: string) {
      const trimmed = query.trim();
      if (trimmed) {
        const exact = await fetchHistoricByKey(fetchImpl, trimmed);
        if (exact.length > 0) {
          return exact;
        }
      }
      const list = await fetchOrderHistory(trimmed, fetchImpl);
      if (!list.ok) {
        return [];
      }
      return list.data.items.flatMap((item) => {
        if (item.status !== "completed") {
          return [];
        }
        const lines = (item.lines ?? []).map((line) => ({
          orderLineId: line.id,
          name: line.name,
          originalSoldQuantity: line.quantity,
        }));
        if (lines.length === 0) {
          return [];
        }
        const view: HistoricReturnSaleView = {
          saleId: item.saleId ?? item.id,
          orderReference: item.orderReference,
          currency: item.total.currency,
          customerLabel: item.customerLabel,
          createdAt: item.createdAt,
          total: item.total,
          itemSummary: item.itemSummary,
          lines,
        };
        return [view];
      });
    },
  };
}

async function fetchHistoricByKey(fetchImpl: typeof fetch, saleKey: string): Promise<readonly HistoricReturnSaleView[]> {
  const response = await fetchImpl(`/api/pos/v1/returns/history/${encodeURIComponent(saleKey)}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "x-correlation-id": crypto.randomUUID(),
      "x-csrf-token": readCookie("cetech_pos_csrf") ?? "",
    },
  });
  const json = (await response.json()) as {
    readonly ok?: boolean;
    readonly data?: {
      readonly saleId?: string;
      readonly orderReference?: string;
      readonly currency?: string;
      readonly customerLabel?: string;
      readonly createdAt?: string;
      readonly total?: { readonly minor?: number; readonly currency?: string };
      readonly itemSummary?: string;
      readonly lines?: ReadonlyArray<{
        readonly orderLineId?: string;
        readonly name?: string;
        readonly originalSoldQuantity?: string;
      }>;
    };
  };
  if (!json.ok || !json.data?.saleId || !json.data.lines || json.data.lines.length === 0) {
    return [];
  }
  const lines = json.data.lines.flatMap((line) => {
    if (!line.orderLineId || line.orderLineId.includes(":receipt:") || !line.originalSoldQuantity) {
      return [];
    }
    return [
      {
        orderLineId: line.orderLineId,
        name: line.name || `Sale line ${line.orderLineId}`,
        originalSoldQuantity: line.originalSoldQuantity,
      },
    ];
  });
  if (lines.length === 0) {
    return [];
  }
  return [
    {
      saleId: json.data.saleId,
      orderReference: json.data.orderReference ?? json.data.saleId,
      currency: json.data.currency ?? "GHS",
      customerLabel: json.data.customerLabel,
      createdAt: json.data.createdAt,
      total:
        json.data.total && typeof json.data.total.minor === "number" && typeof json.data.total.currency === "string"
          ? { minor: json.data.total.minor, currency: json.data.total.currency }
          : undefined,
      itemSummary: json.data.itemSummary,
      lines,
    },
  ];
}

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
