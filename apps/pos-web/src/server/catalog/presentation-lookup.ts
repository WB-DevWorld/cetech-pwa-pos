import type { CatalogPresentationItem, CatalogPresentationLookup } from "../../core/receipt/catalog-presentation";
import type { PosRestFetch } from "../http/server-fetch";

export type SupabaseCatalogPresentationLookupOptions = {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;

function quotedIds(ids: readonly string[]): string {
  return ids.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function parseItem(row: Record<string, unknown>): CatalogPresentationItem | undefined {
  if (typeof row.item_id !== "string" || typeof row.name !== "string") {
    return undefined;
  }
  if (row.kind !== "simple" && row.kind !== "variable" && row.kind !== "variation") {
    return undefined;
  }
  return {
    id: row.item_id,
    name: row.name,
    sku: optionalString(row.sku),
    kind: row.kind,
    parentId: optionalString(row.parent_id),
    variationLabel: optionalString(row.variation_label),
  };
}

export function createSupabaseCatalogPresentationLookup(
  options: SupabaseCatalogPresentationLookupOptions,
): CatalogPresentationLookup {
  const root = `${options.url.replace(/\/+$/, "")}/rest/v1`;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = {
    apikey: options.serviceRoleKey,
    Authorization: `Bearer ${options.serviceRoleKey}`,
    Accept: "application/json",
  };

  return {
    async getItems(organizationId, itemIds) {
      const unique = [...new Set(itemIds)];
      const found = new Map<string, CatalogPresentationItem>();
      if (unique.length === 0) {
        return found;
      }
      const path =
        `pos_catalog_items?organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&item_id=in.(${quotedIds(unique)})` +
        `&select=item_id,name,sku,kind,parent_id,variation_label`;
      const response = await options.fetchImpl(`${root}/${path}`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error("catalog presentation lookup denied infrastructure access");
      }
      if (!response.ok) {
        throw new Error("catalog presentation lookup is unavailable");
      }
      const body: unknown = await response.json();
      if (!Array.isArray(body)) {
        throw new Error("catalog presentation lookup is unavailable");
      }
      for (const row of body) {
        if (!row || typeof row !== "object") {
          continue;
        }
        const item = parseItem(row as Record<string, unknown>);
        if (item) {
          found.set(item.id, item);
        }
      }
      return found;
    },
  };
}
