import type { CatalogSourceRecord } from "../../core/catalog/source";
import { readSupabaseInfrastructureEnv } from "../../config/env";
import type { PosRestFetch } from "../http/server-fetch";
import type { CatalogIdentityMapping } from "./catalog-identity";
import { toCatalogProjectionRow } from "./projection-rows";

export const CATALOG_IDENTITY_SELECT =
  "organization_id,item_id,source_system,source_item_id,tombstoned_at";

export type CatalogProjectionStore = {
  upsertRecords(
    organizationId: string,
    records: ReadonlyArray<CatalogSourceRecord>,
    now: Date,
  ): Promise<void>;
  loadByItemIds(organizationId: string, itemIds: readonly string[]): Promise<ReadonlyArray<CatalogIdentityMapping>>;
};

type RestRow = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 8_000;
const PRICE_KEYS = ["display_price_minor", "display_currency", "displayPrice"] as const;

let processMemoryStore: CatalogProjectionStore | undefined;

export function createMemoryCatalogProjectionStore(): CatalogProjectionStore {
  const rows = new Map<string, CatalogIdentityMapping & { readonly organizationId: string }>();

  function key(organizationId: string, itemId: string): string {
    return `${organizationId}\0${itemId}`;
  }

  return {
    async upsertRecords(organizationId, records, now) {
      const projectionVersion = now.getTime();
      const projectionUpdatedAt = now.toISOString();
      for (const record of records) {
        const persist = toCatalogProjectionPersistRow(
          toCatalogProjectionRow(organizationId, record, projectionVersion, projectionUpdatedAt),
        );
        rows.set(key(organizationId, record.posItemId), {
          organizationId,
          itemId: persist.item_id,
          sourceSystem: persist.source_system,
          sourceItemId: persist.source_item_id,
          tombstoned: persist.tombstoned_at !== null,
        });
      }
    },
    async loadByItemIds(organizationId, itemIds) {
      const mappings: CatalogIdentityMapping[] = [];
      for (const itemId of unique(itemIds)) {
        const row = rows.get(key(organizationId, itemId));
        if (row) {
          mappings.push({
            itemId: row.itemId,
            sourceSystem: row.sourceSystem,
            sourceItemId: row.sourceItemId,
            tombstoned: row.tombstoned,
          });
        }
      }
      return mappings;
    },
  };
}

export function createSupabaseCatalogProjectionStore(options: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): CatalogProjectionStore {
  const root = `${options.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = {
    apikey: options.serviceRoleKey,
    Authorization: `Bearer ${options.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function request(input: {
    readonly path: string;
    readonly method: string;
    readonly body?: unknown;
    readonly prefer?: string;
  }): Promise<{ readonly status: number; readonly body: unknown }> {
    const response = await options.fetchImpl(`${root}/${input.path}`, {
      method: input.method,
      headers: input.prefer ? { ...headers, Prefer: input.prefer } : headers,
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error("durable catalog projection store denied infrastructure access");
    }
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  }

  return {
    async upsertRecords(organizationId, records, now) {
      if (records.length === 0) {
        return;
      }
      const projectionVersion = now.getTime();
      const projectionUpdatedAt = now.toISOString();
      const body = records.map((record) =>
        toCatalogProjectionPersistRow(
          toCatalogProjectionRow(organizationId, record, projectionVersion, projectionUpdatedAt),
        ),
      );
      assertNoPriceKeys(body);
      const result = await request({
        path: "pos_catalog_items?on_conflict=organization_id,item_id",
        method: "POST",
        prefer: "resolution=merge-duplicates,return=minimal",
        body,
      });
      if (result.status !== 201 && result.status !== 200 && result.status !== 204) {
        throw new Error("durable catalog projection store rejected upsert");
      }
    },

    async loadByItemIds(organizationId, itemIds) {
      const ids = unique(itemIds);
      if (ids.length === 0) {
        return [];
      }
      const filter = ids.map((id) => encodeURIComponent(id)).join(",");
      const path =
        `pos_catalog_items?organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&item_id=in.(${filter})&select=${CATALOG_IDENTITY_SELECT}`;
      if (PRICE_KEYS.some((key) => path.includes(key))) {
        throw new Error("catalog identity lookup must not read projection prices");
      }
      const result = await request({ path, method: "GET" });
      if (!result.status || result.status >= 400 || !Array.isArray(result.body)) {
        throw new Error("durable catalog projection store is unavailable");
      }
      return result.body
        .filter((row): row is RestRow => row !== null && typeof row === "object")
        .map(mapIdentityRow)
        .filter((row): row is CatalogIdentityMapping => row !== undefined);
    },
  };
}

/**
 * Staging/production require the durable service-role projection. Local may use
 * process memory when infrastructure is absent. Authenticated/browser clients
 * never receive this store.
 */
export function composeCatalogProjectionStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl?: PosRestFetch,
): CatalogProjectionStore {
  const appEnv = env.APP_ENV ?? "local";
  const infrastructure = readSupabaseInfrastructureEnv(env);
  if (appEnv === "production" || appEnv === "staging") {
    if (!infrastructure || !fetchImpl) {
      throw new Error("durable catalog projection store is required for staging/production");
    }
    return createSupabaseCatalogProjectionStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl,
    });
  }
  if (infrastructure && fetchImpl) {
    return createSupabaseCatalogProjectionStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl,
    });
  }
  processMemoryStore ??= createMemoryCatalogProjectionStore();
  return processMemoryStore;
}

export function toCatalogProjectionPersistRow(row: ReturnType<typeof toCatalogProjectionRow>): {
  readonly organization_id: string;
  readonly item_id: string;
  readonly source_system: string;
  readonly source_item_id: string;
  readonly source_version: string;
  readonly projection_version: number;
  readonly parent_id: string | null;
  readonly kind: string;
  readonly name: string;
  readonly sku: string | null;
  readonly barcodes: readonly string[];
  readonly search_normalized: string;
  readonly variation_label: string | null;
  readonly display_price_minor: null;
  readonly display_currency: null;
  readonly stock_status: string;
  readonly tombstoned_at: string | null;
  readonly projection_updated_at: string;
} {
  return {
    organization_id: row.organizationId,
    item_id: row.itemId,
    source_system: row.sourceSystem,
    source_item_id: row.sourceItemId,
    source_version: row.sourceVersion,
    projection_version: row.projectionVersion,
    parent_id: row.parentId ?? null,
    kind: row.kind,
    name: row.name,
    sku: row.sku ?? null,
    barcodes: [...row.barcodes],
    search_normalized: row.searchNormalized,
    variation_label: row.variationLabel ?? null,
    display_price_minor: null,
    display_currency: null,
    stock_status: row.stockStatus,
    tombstoned_at: row.tombstonedAt ?? null,
    projection_updated_at: row.projectionUpdatedAt,
  };
}

function mapIdentityRow(row: RestRow): CatalogIdentityMapping | undefined {
  if (
    typeof row.item_id !== "string" ||
    typeof row.source_system !== "string" ||
    typeof row.source_item_id !== "string"
  ) {
    return undefined;
  }
  return {
    itemId: row.item_id,
    sourceSystem: row.source_system,
    sourceItemId: row.source_item_id,
    tombstoned: row.tombstoned_at !== null && row.tombstoned_at !== undefined,
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function assertNoPriceKeys(body: ReadonlyArray<Record<string, unknown>>): void {
  for (const row of body) {
    if (row.display_price_minor !== null || row.display_currency !== null) {
      throw new Error("catalog projection persist must not write quote prices");
    }
  }
}
