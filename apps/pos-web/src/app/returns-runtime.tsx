"use client";

import { useMemo } from "react";
import { ReturnsScreen, useReturnFlow, type HistoricSaleLookup } from "../features/returns";
import type { ReturnPort } from "../../../../docs/contracts/ports";
import { createBrowserReturnPort } from "./checkout-client";

export function ReturnsRuntimeScreen({
  returns,
  lookup,
}: {
  readonly returns: ReturnPort;
  readonly lookup?: HistoricSaleLookup;
}) {
  const flow = useReturnFlow(useMemo(() => ({ returns }), [returns]));
  if (!flow.ready || !flow.controller) {
    return <p className="muted">Loading returns…</p>;
  }
  return (
    <ReturnsScreen
      session={flow.session}
      inFlight={flow.inFlight}
      lookup={lookup}
      onSelectSale={(sale) => flow.controller?.selectSale(sale)}
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
      if (!trimmed) {
        return [];
      }
      const response = await fetchImpl(`/api/pos/v1/returns/history/${encodeURIComponent(trimmed)}`, {
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
          lines,
        },
      ];
    },
  };
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
