import type { ApiResult } from "../../../../../docs/contracts/ports";
import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { STAFF_SESSION_COOKIE } from "../../config/auth";
import { resolveCatalogSourcePolicy } from "../../core/catalog/source-policy";
import type { CatalogSyncPage } from "../../core/catalog/sync-page";
import { authFailure } from "../auth/errors";
import { parseCookieHeader } from "../auth/cookies";
import type { StaffSessionStore } from "../auth/session-store";
import { resolveCorrelationId } from "../http/correlation";
import { httpStatusFor } from "../http/status";
import type { CatalogProjectionStore } from "./catalog-projection-store";
import type { CatalogBridge } from "./compose-catalog-bridge";
import { mapBridgeCatalogItems } from "./map-bridge-catalog";

export const CATALOG_SYNC_DEFAULT_LIMIT = 50;
export const CATALOG_SYNC_MAX_LIMIT = 200;

export type HandleCatalogSyncInput = {
  readonly correlationIdHeader?: string;
  readonly cookieHeader?: string;
  readonly cursor?: string | null;
  readonly limit?: string | null;
  readonly modifiedAfter?: string | null;
  readonly now: Date;
  readonly appEnv?: string;
  readonly sessionStore: StaffSessionStore;
  readonly bridge?: CatalogBridge;
  readonly projectionStore?: CatalogProjectionStore;
};

export type HandleCatalogSyncResponse = {
  readonly status: number;
  readonly body: ApiResult<CatalogSyncPage>;
  readonly headers: { readonly "Cache-Control": "no-store"; readonly "X-Correlation-ID": Uuid };
};

const CURSOR_PATTERN = /^[1-9][0-9]*$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

export async function handleCatalogSync(input: HandleCatalogSyncInput): Promise<HandleCatalogSyncResponse> {
  const correlation = resolveCorrelationId(input.correlationIdHeader);
  const headers = { "Cache-Control": "no-store" as const, "X-Correlation-ID": correlation.correlationId };
  const policy = resolveCatalogSourcePolicy(input.appEnv);
  if (!correlation.ok) {
    const body = authFailure("VALIDATION_ERROR", "X-Correlation-ID must be a UUID", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  const sessionId = parseCookieHeader(input.cookieHeader)[STAFF_SESSION_COOKIE];
  let stored = null;
  try {
    stored = sessionId ? await input.sessionStore.get(sessionId, input.now) : null;
  } catch {
    const body = authFailure("INTEGRATION_UNAVAILABLE", "staff session store is unavailable", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  if (!stored) {
    const body = authFailure("AUTH_REQUIRED", "staff session is required", correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  const parsed = parseSyncQuery(input.cursor, input.limit, input.modifiedAfter);
  if (!parsed.ok) {
    const body = authFailure("VALIDATION_ERROR", parsed.message, correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  if (!input.bridge) {
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "catalog producer is unavailable",
      correlation.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  const producer = await input.bridge.fetchPage(parsed.query, correlation.correlationId);
  if (!producer.ok) {
    const body = authFailure(producer.code, producer.message, correlation.correlationId);
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  if (!input.projectionStore) {
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "catalog projection store is unavailable",
      correlation.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  const items = mapBridgeCatalogItems(producer.page.items);
  try {
    await input.projectionStore.upsertRecords(stored.session.organizationId, items, input.now);
  } catch {
    const body = authFailure(
      "INTEGRATION_UNAVAILABLE",
      "catalog projection could not be persisted",
      correlation.correlationId,
    );
    return { status: httpStatusFor(body.error.code), body, headers };
  }
  const page: CatalogSyncPage = {
    policy,
    sourceSystem: "woocommerce",
    items,
    nextCursor: producer.page.nextCursor,
  };
  return {
    status: 200,
    body: { ok: true, data: page, correlationId: correlation.correlationId },
    headers,
  };
}

function parseSyncQuery(
  cursor: string | null | undefined,
  limit: string | null | undefined,
  modifiedAfter: string | null | undefined,
):
  | { readonly ok: true; readonly query: { cursor?: string; limit: number; modifiedAfter?: string } }
  | { readonly ok: false; readonly message: string } {
  let parsedLimit = CATALOG_SYNC_DEFAULT_LIMIT;
  if (limit !== null && limit !== undefined && limit !== "") {
    if (!/^[0-9]+$/.test(limit)) {
      return { ok: false, message: "limit must be a positive integer" };
    }
    const numeric = Number(limit);
    if (!Number.isInteger(numeric) || numeric < 1) {
      return { ok: false, message: "limit must be a positive integer" };
    }
    parsedLimit = Math.min(numeric, CATALOG_SYNC_MAX_LIMIT);
  }
  let parsedCursor: string | undefined;
  if (cursor !== null && cursor !== undefined && cursor !== "") {
    if (!CURSOR_PATTERN.test(cursor)) {
      return { ok: false, message: "cursor must be a positive Woo product id string" };
    }
    parsedCursor = cursor;
  }
  let parsedModified: string | undefined;
  if (modifiedAfter !== null && modifiedAfter !== undefined && modifiedAfter !== "") {
    if (!TIMESTAMP_PATTERN.test(modifiedAfter)) {
      return { ok: false, message: "modifiedAfter must be a contract timestamp" };
    }
    parsedModified = modifiedAfter;
  }
  return { ok: true, query: { cursor: parsedCursor, limit: parsedLimit, modifiedAfter: parsedModified } };
}
