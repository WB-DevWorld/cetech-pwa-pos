import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Quote, QuoteRequest, Uuid } from "../../../../../docs/contracts/domain.generated";
import { readBridgeServiceEnv } from "../../config/env";
import { authFailure } from "../auth/errors";
import { createBridgeServiceIdentity } from "../health/bridge-adapter";
import type { PosRestFetch } from "../http/server-fetch";

export function quotesUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/wp-json/cetech-pos/v1/quotes")) {
    return trimmed;
  }
  if (trimmed.endsWith("/wp-json/cetech-pos/v1")) {
    return `${trimmed}/quotes`;
  }
  return `${trimmed}/wp-json/cetech-pos/v1/quotes`;
}

export function composeQuoteBridge(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: PosRestFetch | undefined,
): { postQuote(request: QuoteRequest, correlationId: Uuid): Promise<ApiResult<Quote>> } | undefined {
  const identity = readBridgeServiceEnv(env);
  if (!identity || !fetchImpl) {
    return undefined;
  }
  const service = createBridgeServiceIdentity({
    username: identity.username,
    applicationPassword: identity.applicationPassword,
  });
  const url = quotesUrl(identity.baseUrl);
  return {
    async postQuote(request, correlationId) {
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: {
            authorization: service.authorizationHeader,
            "content-type": "application/json",
            "x-correlation-id": correlationId,
          },
          body: JSON.stringify(request),
        });
        const json = (await response.json()) as ApiResult<Quote>;
        if (!json || typeof json !== "object" || !("ok" in json)) {
          return authFailure(
            "INTEGRATION_UNAVAILABLE",
            "quote bridge returned an invalid envelope",
            correlationId,
          );
        }
        return json;
      } catch {
        return authFailure("INTEGRATION_UNAVAILABLE", "quote bridge is unavailable", correlationId);
      }
    },
  };
}
