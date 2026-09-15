import type {
  ApiFailure,
  BridgeFinalizeRequest,
  CancelSaleRequest,
  CommandContext,
  PrepareSaleRequest,
  PreparedSale,
  SaleResolution,
  Uuid,
} from "../../../../../docs/contracts/domain.generated";
import type { ApiResult, SalesPort } from "../../../../../docs/contracts/ports";
import { readBridgeServiceEnv } from "../../config/env";
import { authFailure } from "../auth/errors";
import { createBridgeServiceIdentity } from "../health/bridge-adapter";
import type { PosRestFetch } from "../http/server-fetch";
import { validateCanonicalDef } from "../quotes/canonical-schema";

export function composeBridgeSalesPort(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: PosRestFetch | undefined,
): SalesPort | undefined {
  const bridge = readBridgeServiceEnv(env);
  if (!bridge || !fetchImpl) return undefined;
  const identity = createBridgeServiceIdentity({
    username: bridge.username,
    applicationPassword: bridge.applicationPassword,
  });
  const root = `${bridge.baseUrl.replace(/\/$/, "")}/wp-json/cetech-pos/v1`;

  async function command<T>(
    path: string,
    body: unknown,
    context: CommandContext,
    schema: "PreparedSale" | "SaleResolution",
  ): Promise<ApiResult<T>> {
    return request<T>(
      `${root}${path}`,
      {
        method: "POST",
        headers: {
          authorization: identity.authorizationHeader,
          "content-type": "application/json",
          "x-correlation-id": context.correlationId,
          "idempotency-key": context.idempotencyKey,
        },
        body: JSON.stringify(body),
      },
      context.correlationId,
      schema,
    );
  }

  return {
    async prepare(input: PrepareSaleRequest, context: CommandContext): Promise<ApiResult<PreparedSale>> {
      return command<PreparedSale>("/sales/prepare", input, context, "PreparedSale");
    },
    async resolve(transactionId: Uuid): Promise<ApiResult<SaleResolution>> {
      const correlationId = crypto.randomUUID();
      return request<SaleResolution>(
        `${root}/sales/${encodeURIComponent(transactionId)}`,
        {
          method: "GET",
          headers: {
            authorization: identity.authorizationHeader,
            "x-correlation-id": correlationId,
          },
        },
        correlationId,
        "SaleResolution",
      );
    },
    async confirmPayment(input: BridgeFinalizeRequest, context: CommandContext): Promise<ApiResult<SaleResolution>> {
      return command<SaleResolution>("/sales/finalize", input, context, "SaleResolution");
    },
    async cancel(input: CancelSaleRequest, context: CommandContext): Promise<ApiResult<SaleResolution>> {
      return command<SaleResolution>("/sales/cancel", input, context, "SaleResolution");
    },
  };

  async function request<T>(
    url: string,
    init: Parameters<PosRestFetch>[1],
    correlationId: Uuid,
    schema: "PreparedSale" | "SaleResolution",
  ): Promise<ApiResult<T>> {
    try {
      const response = await fetchImpl(url, init);
      const json = await response.json();
      if (isFailure(json)) return json;
      if (!isSuccessEnvelope(json)) {
        return authFailure("INTEGRATION_UNAVAILABLE", "commerce bridge returned an invalid envelope", correlationId);
      }
      if (!validateCanonicalDef(schema, json.data)) {
        return authFailure(
          "INTEGRATION_UNAVAILABLE",
          `commerce bridge returned an invalid ${schema}`,
          correlationId,
        );
      }
      return json as ApiResult<T>;
    } catch {
      return authFailure("INTEGRATION_UNAVAILABLE", "commerce bridge is unavailable", correlationId);
    }
  }
}

function isSuccessEnvelope(value: unknown): value is { ok: true; data: unknown; correlationId: Uuid } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.ok === true && "data" in row && typeof row.correlationId === "string";
}

function isFailure(value: unknown): value is ApiFailure {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.ok === false && typeof row.correlationId === "string" && row.error !== null && typeof row.error === "object";
}
