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
    lookup: createReceiptBackedSaleLookup({ fetchImpl: options?.fetchImpl }),
  };
}

export function createReceiptBackedSaleLookup(options: { readonly fetchImpl?: typeof fetch } = {}): HistoricSaleLookup {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async search(query: string) {
      const trimmed = query.trim();
      if (!trimmed) {
        return [];
      }
      const correlation = crypto.randomUUID();
      const headers = {
        "x-correlation-id": correlation,
        "x-csrf-token": readCookie("cetech_pos_csrf") ?? "",
      };
      const saleResponse = await fetchImpl(`/api/pos/v1/sales/${encodeURIComponent(trimmed)}`, {
        method: "GET",
        credentials: "include",
        headers,
      });
      const saleJson = (await saleResponse.json()) as {
        readonly ok?: boolean;
        readonly data?: { readonly saleId?: string; readonly orderReference?: string; readonly transactionId?: string };
      };
      if (!saleJson.ok || !saleJson.data?.saleId || !saleJson.data.transactionId) {
        return [];
      }
      const receiptResponse = await fetchImpl(`/api/pos/v1/receipts/${encodeURIComponent(saleJson.data.transactionId)}`, {
        method: "GET",
        credentials: "include",
        headers: { "x-correlation-id": crypto.randomUUID(), "x-csrf-token": readCookie("cetech_pos_csrf") ?? "" },
      });
      const receiptJson = (await receiptResponse.json()) as {
        readonly ok?: boolean;
        readonly data?: {
          readonly total?: { readonly currency?: string };
          readonly lines?: ReadonlyArray<{ readonly name: string; readonly quantity: string }>;
        };
      };
      const lines = receiptJson.ok
        ? (receiptJson.data?.lines ?? []).map((line, index) => ({
            orderLineId: `${saleJson.data!.saleId}:receipt:${index}`,
            name: line.name,
            originalSoldQuantity: line.quantity,
          }))
        : [];
      return [
        {
          saleId: saleJson.data.saleId,
          orderReference: saleJson.data.orderReference ?? saleJson.data.saleId,
          currency: receiptJson.data?.total?.currency ?? "GHS",
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
