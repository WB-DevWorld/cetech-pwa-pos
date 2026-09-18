import { preserveBarcode } from "../../core/catalog/normalize";
import { stableCatalogPosItemId } from "../../core/catalog/stable-pos-id";
import { mapTransitionalCatalogItem, type TransitionalCatalogInput } from "../../core/catalog/transitional-mapper";
import type { CatalogSourceRecord } from "../../core/catalog/source";

const KINDS = new Set(["simple", "variable", "variation"]);
const STOCK = new Set(["in_stock", "out_of_stock", "backorder", "unknown"]);
const UNSAFE_PRICE_KEYS = [
  "price",
  "regularPrice",
  "salePrice",
  "listPrice",
  "unitPrice",
  "tax",
  "b2bPrice",
  "woodmartPrice",
] as const;

export type BridgeCatalogSourceItem = {
  readonly sourceSystem: "woocommerce";
  readonly sourceItemId: string;
  readonly sourceParentId?: string;
  readonly sourceVersion: string;
  readonly name: string;
  readonly sku?: string;
  readonly barcodes?: ReadonlyArray<string>;
  readonly kind: "simple" | "variable" | "variation";
  readonly variationLabel?: string;
  readonly purchasable?: boolean;
  readonly stockStatus: CatalogSourceRecord["stockStatus"];
  readonly sourceUpdatedAt: string;
  readonly deleted?: boolean;
  readonly listPriceMinor?: number;
  readonly listPriceCurrency?: string;
};

/**
 * Maps STG-05 catalog producer DTOs onto the provider-neutral transitional model.
 * Woo sourceItemId remains source identity only. Opaque posItemId is assigned here.
 * Advisory displayPrice (Money envelope) is copied as listPriceMinor/listPriceCurrency.
 * Quote-time POST /quotes remains pricing authority. Unsafe price-like keys are ignored.
 */
export function mapBridgeCatalogItem(raw: unknown): CatalogSourceRecord | null {
  const item = parseBridgeItem(raw);
  if (!item) {
    return null;
  }
  const posItemId = stableCatalogPosItemId(item.sourceSystem, item.sourceItemId);
  const parentId =
    item.kind === "variation" && item.sourceParentId
      ? stableCatalogPosItemId(item.sourceSystem, item.sourceParentId)
      : undefined;
  const input: TransitionalCatalogInput = {
    posItemId,
    sourceItemId: item.sourceItemId,
    sourceVersion: item.sourceVersion,
    sourceSystem: item.sourceSystem,
    name: item.name,
    sku: item.sku,
    barcodes: item.barcodes,
    kind: item.kind,
    parentId,
    variationLabel: item.variationLabel,
    purchasable: item.purchasable,
    catalogStockStatus: item.stockStatus,
    sourceUpdatedAt: item.sourceUpdatedAt,
    deleted: item.deleted,
    listPriceMinor: item.listPriceMinor,
    listPriceCurrency: item.listPriceCurrency,
  };
  return mapTransitionalCatalogItem(input);
}

export function mapBridgeCatalogItems(rawItems: unknown): ReadonlyArray<CatalogSourceRecord> {
  if (!Array.isArray(rawItems)) {
    return [];
  }
  const mapped: CatalogSourceRecord[] = [];
  for (const raw of rawItems) {
    const item = mapBridgeCatalogItem(raw);
    if (item) {
      mapped.push(item);
    }
  }
  return mapped;
}

function parseBridgeItem(raw: unknown): BridgeCatalogSourceItem | null {
  if (raw === null || typeof raw !== "object") {
    return null;
  }
  const row = raw as Record<string, unknown>;
  if (row.sourceSystem !== "woocommerce") {
    return null;
  }
  const sourceItemId = asNonEmptyString(row.sourceItemId);
  const name = asNonEmptyString(row.name);
  const sourceVersion = asNonEmptyString(row.sourceVersion);
  const sourceUpdatedAt = asNonEmptyString(row.sourceUpdatedAt);
  const kind = typeof row.kind === "string" && KINDS.has(row.kind) ? row.kind : null;
  if (!sourceItemId || !name || !sourceVersion || !sourceUpdatedAt || !kind) {
    return null;
  }
  const stockStatus =
    typeof row.stockStatus === "string" && STOCK.has(row.stockStatus) ? row.stockStatus : "unknown";
  const sku = row.sku === undefined || row.sku === null ? undefined : preserveBarcode(String(row.sku));
  const barcodes = parseBarcodes(row.barcodes, sku);
  const sourceParentId = asNonEmptyString(row.sourceParentId);
  const advisory = parseAdvisoryListPrice(row);
  return {
    sourceSystem: "woocommerce",
    sourceItemId,
    sourceParentId: kind === "variation" ? sourceParentId : undefined,
    sourceVersion,
    name,
    sku: sku && sku.length > 0 ? sku : undefined,
    barcodes,
    kind: kind as BridgeCatalogSourceItem["kind"],
    variationLabel: asNonEmptyString(row.variationLabel),
    purchasable: typeof row.purchasable === "boolean" ? row.purchasable : undefined,
    stockStatus: stockStatus as BridgeCatalogSourceItem["stockStatus"],
    sourceUpdatedAt,
    deleted: row.deleted === true,
    listPriceMinor: advisory.listPriceMinor,
    listPriceCurrency: advisory.listPriceCurrency,
  };
}

function parseAdvisoryListPrice(row: Record<string, unknown>): {
  readonly listPriceMinor?: number;
  readonly listPriceCurrency?: string;
} {
  const fromEnvelope = parseMoneyEnvelope(row.displayPrice);
  if (fromEnvelope) {
    return { listPriceMinor: fromEnvelope.minor, listPriceCurrency: fromEnvelope.currency };
  }
  const minor = row.listPriceMinor;
  const currency = row.listPriceCurrency;
  if (
    typeof minor === "number" &&
    Number.isInteger(minor) &&
    minor >= 0 &&
    typeof currency === "string" &&
    currency.trim().length > 0
  ) {
    return { listPriceMinor: minor, listPriceCurrency: currency.trim() };
  }
  return {};
}

function parseMoneyEnvelope(value: unknown): { readonly minor: number; readonly currency: string } | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const row = value as Record<string, unknown>;
  const minor = row.minor;
  const currency = row.currency;
  if (typeof minor !== "number" || !Number.isInteger(minor) || minor < 0) {
    return undefined;
  }
  if (typeof currency !== "string") {
    return undefined;
  }
  const trimmed = currency.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return { minor, currency: trimmed };
}

function parseBarcodes(value: unknown, sku: string | undefined): ReadonlyArray<string> {
  const codes: string[] = [];
  if (Array.isArray(value)) {
    for (const entry of value) {
      const code = preserveBarcode(String(entry));
      if (code.length > 0) {
        codes.push(code);
      }
    }
  } else if (sku && sku.length > 0) {
    codes.push(sku);
  }
  return codes;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    if (typeof value === "number" && Number.isFinite(value)) {
      const asString = String(value);
      return asString.length > 0 ? asString : undefined;
    }
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function bridgeCatalogItemHasPriceFields(raw: unknown): boolean {
  if (raw === null || typeof raw !== "object") {
    return false;
  }
  const row = raw as Record<string, unknown>;
  return UNSAFE_PRICE_KEYS.some((key) => key in row && row[key] !== undefined);
}
