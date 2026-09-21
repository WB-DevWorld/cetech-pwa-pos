import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import type {
  BridgeFinalizeRequest,
  CancelSaleRequest,
  CommandContext,
  PreparedSale,
  PrepareSaleRequest,
  SaleResolution,
  Uuid,
} from "../../../../../docs/contracts/domain.generated";
import { readBridgeServiceEnv } from "../../config/env";
import { authFailure } from "../auth/errors";
import { createBridgeServiceIdentity } from "../health/bridge-adapter";
import type { PosRestFetch } from "../http/server-fetch";
import { isPreparedSale, isSaleResolution } from "./schema";

function bridgeRoot(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

export function prepareUrl(baseUrl: string): string {
  return `${bridgeRoot(baseUrl)}/wp-json/cetech-pos/v1/sales/prepare`;
}

export function resolveUrl(baseUrl: string, transactionId: string): string {
  return `${bridgeRoot(baseUrl)}/wp-json/cetech-pos/v1/sales/${transactionId}`;
}

export function finalizeUrl(baseUrl: string): string {
  return `${bridgeRoot(baseUrl)}/wp-json/cetech-pos/v1/sales/finalize`;
}

export function cancelUrl(baseUrl: string): string {
  return `${bridgeRoot(baseUrl)}/wp-json/cetech-pos/v1/sales/cancel`;
}

export function composeSalesBridge(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: PosRestFetch | undefined,
): Pick<SalesPort, "prepare" | "resolve" | "confirmPayment" | "cancel"> | undefined {
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
        return authFailure("INTEGRATION_UNAVAILABLE", "sales bridge returned an invalid envelope", correlationId);
      }
      if (!json.ok) {
        return json;
      }
      if (!validate(json.data)) {
        return authFailure("INTEGRATION_UNAVAILABLE", invalidMessage, correlationId);
      }
      return json;
    } catch {
      return authFailure("INTEGRATION_UNAVAILABLE", "sales bridge is unavailable", correlationId);
    }
  }

  return {
    async prepare(input: PrepareSaleRequest, context: CommandContext): Promise<ApiResult<PreparedSale>> {
      const { customerSnapshot: _customerSnapshot, ...bridgeInput } = input;
      void _customerSnapshot;
      return postJson(
        prepareUrl(root),
        context.correlationId,
        context.idempotencyKey,
        bridgeInput,
        isPreparedSale,
        "sales bridge returned an invalid PreparedSale",
      );
    },
    async resolve(transactionId): Promise<ApiResult<SaleResolution>> {
      const correlationId = crypto.randomUUID();
      try {
        const response = await requestJson(resolveUrl(root, transactionId), {
          method: "GET",
          headers: {
            authorization: service.authorizationHeader,
            "x-correlation-id": correlationId,
          },
        });
        const json = (await response.json()) as ApiResult<SaleResolution>;
        if (!json || typeof json !== "object" || !("ok" in json)) {
          return authFailure("INTEGRATION_UNAVAILABLE", "sales bridge returned an invalid envelope", correlationId);
        }
        if (!json.ok) {
          return json;
        }
        if (!isSaleResolution(json.data)) {
          return authFailure("INTEGRATION_UNAVAILABLE", "sales bridge returned an invalid SaleResolution", correlationId);
        }
        return json;
      } catch {
        return authFailure("INTEGRATION_UNAVAILABLE", "sales bridge is unavailable", correlationId);
      }
    },
    async confirmPayment(
      input: BridgeFinalizeRequest,
      context: CommandContext,
    ): Promise<ApiResult<SaleResolution>> {
      return postJson(
        finalizeUrl(root),
        context.correlationId,
        context.idempotencyKey,
        input,
        isSaleResolution,
        "sales bridge returned an invalid SaleResolution",
      );
    },
    async cancel(input: CancelSaleRequest, context: CommandContext): Promise<ApiResult<SaleResolution>> {
      return postJson(
        cancelUrl(root),
        context.correlationId,
        context.idempotencyKey,
        input,
        isSaleResolution,
        "sales bridge returned an invalid SaleResolution",
      );
    },
  };
}
