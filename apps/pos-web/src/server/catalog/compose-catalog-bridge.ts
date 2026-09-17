import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { readBridgeServiceEnv } from "../../config/env";
import { createBridgeServiceIdentity } from "../health/bridge-adapter";
import type { PosRestFetch } from "../http/server-fetch";

export type BridgeCatalogPageQuery = {
  readonly cursor?: string;
  readonly limit?: number;
  readonly modifiedAfter?: string;
};

export type BridgeCatalogProducerPage = {
  readonly items: unknown[];
  readonly nextCursor: string | null;
};

export type BridgeCatalogProducerResult =
  | { readonly ok: true; readonly page: BridgeCatalogProducerPage; readonly correlationId: Uuid }
  | { readonly ok: false; readonly code: "INTEGRATION_UNAVAILABLE" | "VALIDATION_ERROR"; readonly message: string; readonly correlationId: Uuid };

export type CatalogBridge = {
  fetchPage(query: BridgeCatalogPageQuery, correlationId: Uuid): Promise<BridgeCatalogProducerResult>;
};

export function catalogUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/wp-json/cetech-pos/v1/catalog")) {
    return trimmed;
  }
  if (trimmed.endsWith("/wp-json/cetech-pos/v1")) {
    return `${trimmed}/catalog`;
  }
  return `${trimmed}/wp-json/cetech-pos/v1/catalog`;
}

export function composeCatalogBridge(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: PosRestFetch | undefined,
): CatalogBridge | undefined {
  const identity = readBridgeServiceEnv(env);
  if (!identity || !fetchImpl) {
    return undefined;
  }
  const service = createBridgeServiceIdentity({
    username: identity.username,
    applicationPassword: identity.applicationPassword,
  });
  const url = catalogUrl(identity.baseUrl);
  return {
    async fetchPage(query, correlationId) {
      const target = withCatalogQuery(url, query);
      try {
        const response = await fetchImpl(target, {
          method: "GET",
          headers: {
            authorization: service.authorizationHeader,
            accept: "application/json",
            "x-correlation-id": correlationId,
          },
        });
        let json: unknown;
        try {
          json = await response.json();
        } catch {
          return {
            ok: false,
            code: "INTEGRATION_UNAVAILABLE",
            message: "catalog producer is unavailable",
            correlationId,
          };
        }
        if (isRestNoRoute(json)) {
          return {
            ok: false,
            code: "INTEGRATION_UNAVAILABLE",
            message: "catalog producer is unavailable",
            correlationId,
          };
        }
        if (isValidationFailure(json)) {
          return {
            ok: false,
            code: "VALIDATION_ERROR",
            message: producerMessage(json, "catalog query is invalid"),
            correlationId,
          };
        }
        if (isProducerUnavailable(response.status, json)) {
          return {
            ok: false,
            code: "INTEGRATION_UNAVAILABLE",
            message: "catalog producer is unavailable",
            correlationId,
          };
        }
        const page = unwrapProducerPage(json);
        if (!page) {
          return {
            ok: false,
            code: "INTEGRATION_UNAVAILABLE",
            message: "catalog producer returned an invalid envelope",
            correlationId,
          };
        }
        return { ok: true, page, correlationId };
      } catch {
        return {
          ok: false,
          code: "INTEGRATION_UNAVAILABLE",
          message: "catalog producer is unavailable",
          correlationId,
        };
      }
    },
  };
}

export function withCatalogQuery(url: string, query: BridgeCatalogPageQuery): string {
  const parsed = new URL(url);
  if (query.cursor) {
    parsed.searchParams.set("cursor", query.cursor);
  }
  if (query.limit !== undefined) {
    parsed.searchParams.set("limit", String(query.limit));
  }
  if (query.modifiedAfter) {
    parsed.searchParams.set("modifiedAfter", query.modifiedAfter);
  }
  return parsed.toString();
}

function unwrapProducerPage(body: unknown): BridgeCatalogProducerPage | null {
  if (body === null || typeof body !== "object") {
    return null;
  }
  const root = body as Record<string, unknown>;
  const data =
    root.data !== null && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;
  if (root.ok === false) {
    return null;
  }
  if (!Array.isArray(data.items)) {
    return null;
  }
  const nextCursor =
    data.nextCursor === null || data.nextCursor === undefined
      ? null
      : typeof data.nextCursor === "string" && data.nextCursor.length > 0
        ? data.nextCursor
        : null;
  return { items: data.items, nextCursor };
}

function isRestNoRoute(body: unknown): boolean {
  if (body === null || typeof body !== "object") {
    return false;
  }
  const root = body as Record<string, unknown>;
  if (root.code === "rest_no_route") {
    return true;
  }
  const error = root.error;
  if (error !== null && typeof error === "object" && (error as Record<string, unknown>).code === "rest_no_route") {
    return true;
  }
  return typeof root.message === "string" && root.message.toLowerCase().includes("no route");
}

function isProducerUnavailable(status: number, body: unknown): boolean {
  if (status === 401 || status === 403 || status >= 500) {
    return true;
  }
  if (body === null || typeof body !== "object") {
    return status !== 200;
  }
  const root = body as Record<string, unknown>;
  if (root.ok === false) {
    const code =
      root.error !== null && typeof root.error === "object"
        ? (root.error as Record<string, unknown>).code
        : undefined;
    return code === "INTEGRATION_UNAVAILABLE" || code === "AUTH_REQUIRED" || status !== 200;
  }
  return false;
}

function isValidationFailure(body: unknown): boolean {
  if (body === null || typeof body !== "object") {
    return false;
  }
  const root = body as Record<string, unknown>;
  const code =
    root.error !== null && typeof root.error === "object"
      ? (root.error as Record<string, unknown>).code
      : root.code;
  return code === "VALIDATION_ERROR";
}

function producerMessage(body: unknown, fallback: string): string {
  if (body === null || typeof body !== "object") {
    return fallback;
  }
  const root = body as Record<string, unknown>;
  if (typeof root.message === "string" && root.message.length > 0) {
    return root.message;
  }
  if (root.error !== null && typeof root.error === "object") {
    const message = (root.error as Record<string, unknown>).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return fallback;
}
