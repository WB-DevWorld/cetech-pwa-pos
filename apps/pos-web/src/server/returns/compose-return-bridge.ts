import type { ApiResult, BridgeReturnEffectsPort } from "../../../../../docs/contracts/ports";
import type {
  BridgeCommercialRefundRequest,
  BridgeCommercialRefundState,
  BridgeStockDispositionRequest,
  BridgeStockDispositionState,
  CommandContext,
  Uuid,
} from "../../../../../docs/contracts/domain.generated";
import { readBridgeServiceEnv } from "../../config/env";
import { authFailure } from "../auth/errors";
import { createBridgeServiceIdentity } from "../health/bridge-adapter";
import type { PosRestFetch } from "../http/server-fetch";
import {
  isBridgeCommercialRefundState,
  isBridgeStockDispositionState,
} from "./schema";

function bridgeRoot(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

export function commercialRefundUrl(baseUrl: string): string {
  return `${bridgeRoot(baseUrl)}/wp-json/cetech-pos/v1/returns/commercial-refund`;
}

export function commercialRefundResolveUrl(baseUrl: string, commercialRefundId: string): string {
  return `${bridgeRoot(baseUrl)}/wp-json/cetech-pos/v1/returns/commercial-refund/${commercialRefundId}`;
}

export function stockDispositionUrl(baseUrl: string): string {
  return `${bridgeRoot(baseUrl)}/wp-json/cetech-pos/v1/returns/stock-disposition`;
}

export function stockDispositionResolveUrl(baseUrl: string, stockDispositionId: string): string {
  return `${bridgeRoot(baseUrl)}/wp-json/cetech-pos/v1/returns/stock-disposition/${stockDispositionId}`;
}

export function composeReturnBridge(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: PosRestFetch | undefined,
): BridgeReturnEffectsPort | undefined {
  const identity = readBridgeServiceEnv(env);
  if (!identity || !fetchImpl) {
    return undefined;
  }
  const requestJson = fetchImpl;
  const service = createBridgeServiceIdentity({
    username: identity.username,
    applicationPassword: identity.applicationPassword,
  });
  const root = identity.baseUrl;

  async function postJson<T>(
    url: string,
    correlationId: Uuid,
    idempotencyKey: Uuid | undefined,
    body: unknown,
    validate: (value: unknown) => value is T,
    invalidMessage: string,
  ): Promise<ApiResult<T>> {
    try {
      const headers: Record<string, string> = {
        authorization: service.authorizationHeader,
        "content-type": "application/json",
        "x-correlation-id": correlationId,
      };
      if (idempotencyKey) {
        headers["idempotency-key"] = idempotencyKey;
      }
      const response = await requestJson(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as ApiResult<T>;
      if (!json || typeof json !== "object" || !("ok" in json)) {
        return authFailure("INTEGRATION_UNAVAILABLE", "return-effects bridge returned an invalid envelope", correlationId);
      }
      if (!json.ok) {
        return json;
      }
      if (!validate(json.data)) {
        return authFailure("INTEGRATION_UNAVAILABLE", invalidMessage, correlationId);
      }
      return json;
    } catch {
      return authFailure("INTEGRATION_UNAVAILABLE", "return-effects bridge is unavailable", correlationId);
    }
  }

  async function getJson<T>(
    url: string,
    correlationId: Uuid,
    validate: (value: unknown) => value is T,
    invalidMessage: string,
  ): Promise<ApiResult<T>> {
    try {
      const response = await requestJson(url, {
        method: "GET",
        headers: {
          authorization: service.authorizationHeader,
          "x-correlation-id": correlationId,
        },
      });
      const json = (await response.json()) as ApiResult<T>;
      if (!json || typeof json !== "object" || !("ok" in json)) {
        return authFailure("INTEGRATION_UNAVAILABLE", "return-effects bridge returned an invalid envelope", correlationId);
      }
      if (!json.ok) {
        return json;
      }
      if (!validate(json.data)) {
        return authFailure("INTEGRATION_UNAVAILABLE", invalidMessage, correlationId);
      }
      return json;
    } catch {
      return authFailure("INTEGRATION_UNAVAILABLE", "return-effects bridge is unavailable", correlationId);
    }
  }

  return {
    async preview() {
      return authFailure("INTEGRATION_UNAVAILABLE", "return preview is owned by the POS BFF, not the commerce bridge", crypto.randomUUID());
    },
    async applyCommercialRefund(
      input: BridgeCommercialRefundRequest,
      context: CommandContext,
    ): Promise<ApiResult<BridgeCommercialRefundState>> {
      return postJson(
        commercialRefundUrl(root),
        context.correlationId,
        context.idempotencyKey,
        input,
        isBridgeCommercialRefundState,
        "return-effects bridge returned an invalid BridgeCommercialRefundState",
      );
    },
    async resolveCommercialRefund(commercialRefundId: Uuid): Promise<ApiResult<BridgeCommercialRefundState>> {
      return getJson(
        commercialRefundResolveUrl(root, commercialRefundId),
        crypto.randomUUID(),
        isBridgeCommercialRefundState,
        "return-effects bridge returned an invalid BridgeCommercialRefundState",
      );
    },
    async applyStockDisposition(
      input: BridgeStockDispositionRequest,
      context: CommandContext,
    ): Promise<ApiResult<BridgeStockDispositionState>> {
      return postJson(
        stockDispositionUrl(root),
        context.correlationId,
        context.idempotencyKey,
        input,
        isBridgeStockDispositionState,
        "return-effects bridge returned an invalid BridgeStockDispositionState",
      );
    },
    async resolveStockDisposition(stockDispositionId: Uuid): Promise<ApiResult<BridgeStockDispositionState>> {
      return getJson(
        stockDispositionResolveUrl(root, stockDispositionId),
        crypto.randomUUID(),
        isBridgeStockDispositionState,
        "return-effects bridge returned an invalid BridgeStockDispositionState",
      );
    },
  };
}
