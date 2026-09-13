import type { CatalogItem, CatalogPage, Id } from "../../../../../docs/contracts/domain.generated";
import { normalizeSearchText, preserveBarcode, searchHaystackIncludes } from "./normalize";
import { searchDocumentFor } from "./transitional-mapper";
import type {
  BarcodeLookup,
  CatalogProjectionMeta,
  CatalogSourceRecord,
  ProjectedCatalogItem,
} from "./source";

export type CatalogProjectionSnapshot = {
  readonly items: ReadonlyArray<ProjectedCatalogItem>;
  readonly meta: CatalogProjectionMeta;
};

function cloneItem(item: ProjectedCatalogItem): ProjectedCatalogItem {
  return {
    ...item,
    barcodes: [...item.barcodes],
    displayPrice: item.displayPrice ? { ...item.displayPrice } : undefined,
  };
}

function toCatalogItem(item: ProjectedCatalogItem): CatalogItem {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    barcodes: [...item.barcodes],
    kind: item.kind,
    parentId: item.parentId,
    variationLabel: item.variationLabel,
    displayPrice: item.displayPrice ? { ...item.displayPrice } : undefined,
    stockStatus: item.stockStatus,
    projectionUpdatedAt: item.projectionUpdatedAt,
  };
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class CatalogProjectionEngine {
  private readonly items = new Map<Id, ProjectedCatalogItem>();
  private readonly barcodes = new Map<string, Set<Id>>();
  private projectionVersion = 0;
  private sourceVersion = "";
  private sourceSystem = "transitional-commerce";
  private updatedAt = "1970-01-01T00:00:00.000Z";

  snapshot(): CatalogProjectionSnapshot {
    const items = [...this.items.values()].map(cloneItem).sort((a, b) => compareId(a.id, b.id));
    return { items, meta: this.meta() };
  }

  meta(): CatalogProjectionMeta {
    return {
      projectionVersion: this.projectionVersion,
      sourceVersion: this.sourceVersion,
      sourceSystem: this.sourceSystem,
      updatedAt: this.updatedAt,
      itemCount: [...this.items.values()].filter((item) => !item.tombstoned).length,
    };
  }

  liveItems(): ReadonlyArray<CatalogItem> {
    return [...this.items.values()]
      .filter((item) => !item.tombstoned)
      .sort((a, b) => compareId(a.id, b.id))
      .map(toCatalogItem);
  }

  get(id: Id): CatalogItem | undefined {
    const item = this.items.get(id);
    if (!item || item.tombstoned) {
      return undefined;
    }
    return toCatalogItem(item);
  }

  lookupBarcode(rawBarcode: string): BarcodeLookup {
    const barcode = preserveBarcode(rawBarcode);
    const ids = [...(this.barcodes.get(barcode) ?? [])].sort(compareId);
    const items = ids
      .map((id) => this.items.get(id))
      .filter((item): item is ProjectedCatalogItem => item !== undefined && !item.tombstoned)
      .map(toCatalogItem);
    if (items.length === 0) {
      return { status: "missing", barcode };
    }
    if (items.length === 1) {
      return { status: "unique", barcode, item: items[0]! };
    }
    return { status: "duplicate", barcode, items };
  }

  search(input: {
    query?: string;
    barcode?: string;
    productId?: Id;
    parentId?: Id;
    cursor?: string;
    limit?: number;
  }): CatalogPage {
    const limit = input.limit && input.limit > 0 ? Math.min(input.limit, 200) : 50;
    if (input.barcode !== undefined && input.barcode.length > 0) {
      const lookup = this.lookupBarcode(input.barcode);
      if (lookup.status === "missing") {
        return { items: [] };
      }
      if (lookup.status === "unique") {
        return { items: [lookup.item] };
      }
      return { items: [...lookup.items] };
    }
    if (input.productId) {
      const item = this.get(input.productId);
      return { items: item ? [item] : [] };
    }
    let candidates = [...this.items.values()].filter((item) => !item.tombstoned);
    if (input.parentId) {
      candidates = candidates.filter((item) => item.parentId === input.parentId);
    } else if (input.query !== undefined) {
      candidates = candidates.filter((item) => item.kind !== "variation");
      if (input.query.trim()) {
        const needle = input.query;
        candidates = candidates.filter(
          (item) =>
            searchHaystackIncludes(item.searchNormalized, needle) ||
            item.barcodes.some((code) => code.includes(preserveBarcode(needle.trim()))),
        );
      }
    } else {
      candidates = candidates.filter((item) => item.kind !== "variation");
    }
    candidates.sort((a, b) => compareId(a.id, b.id));
    if (input.cursor) {
      candidates = candidates.filter((item) => item.id > input.cursor!);
    }
    const page = candidates.slice(0, limit).map(toCatalogItem);
    const next = candidates[limit];
    return next ? { items: page, nextCursor: next.id } : { items: page };
  }

  rebuild(records: ReadonlyArray<CatalogSourceRecord>, sourceVersion: string, updatedAt: string): CatalogProjectionMeta {
    this.items.clear();
    this.barcodes.clear();
    this.projectionVersion += 1;
    this.sourceVersion = sourceVersion;
    this.updatedAt = updatedAt;
    const ordered = [...records].sort((a, b) => compareId(a.posItemId, b.posItemId));
    for (const record of ordered) {
      this.applyOne(record, updatedAt, false);
    }
    if (ordered[0]) {
      this.sourceSystem = ordered[0].sourceSystem;
    }
    return this.meta();
  }

  applyIncremental(
    records: ReadonlyArray<CatalogSourceRecord>,
    sourceVersion: string,
    updatedAt: string,
  ): CatalogProjectionMeta {
    this.projectionVersion += 1;
    this.sourceVersion = sourceVersion;
    this.updatedAt = updatedAt;
    const ordered = [...records].sort((a, b) => compareId(a.posItemId, b.posItemId));
    for (const record of ordered) {
      this.applyOne(record, updatedAt, true);
    }
    return this.meta();
  }

  replaceSnapshot(snapshot: CatalogProjectionSnapshot): void {
    this.items.clear();
    this.barcodes.clear();
    this.projectionVersion = snapshot.meta.projectionVersion;
    this.sourceVersion = snapshot.meta.sourceVersion;
    this.sourceSystem = snapshot.meta.sourceSystem;
    this.updatedAt = snapshot.meta.updatedAt;
    for (const item of snapshot.items) {
      const cloned = cloneItem(item);
      this.items.set(cloned.id, cloned);
      if (!cloned.tombstoned) {
        this.indexBarcodes(cloned.id, cloned.barcodes);
      }
    }
  }

  private applyOne(record: CatalogSourceRecord, updatedAt: string, incremental: boolean): void {
    const existing = this.items.get(record.posItemId);
    if (existing) {
      this.unindexBarcodes(existing.id, existing.barcodes);
    }
    if (record.deleted) {
      const tombstone: ProjectedCatalogItem = {
        id: record.posItemId,
        name: record.name,
        sku: record.sku,
        barcodes: [],
        kind: record.kind,
        parentId: record.parentId,
        variationLabel: record.variationLabel,
        displayPrice: record.displayPrice,
        stockStatus: record.stockStatus,
        projectionUpdatedAt: updatedAt,
        sourceSystem: record.sourceSystem,
        sourceItemId: record.sourceItemId,
        sourceVersion: record.sourceVersion,
        searchNormalized: "",
        tombstoned: true,
      };
      this.items.set(record.posItemId, tombstone);
      return;
    }
    const barcodes = record.barcodes.map(preserveBarcode);
    const projected: ProjectedCatalogItem = {
      id: record.posItemId,
      name: record.name,
      sku: record.sku,
      barcodes,
      kind: record.kind,
      parentId: record.parentId,
      variationLabel: record.variationLabel,
      displayPrice: record.displayPrice,
      stockStatus: record.stockStatus,
      projectionUpdatedAt: incremental ? updatedAt : record.sourceUpdatedAt,
      sourceSystem: record.sourceSystem,
      sourceItemId: record.sourceItemId,
      sourceVersion: record.sourceVersion,
      searchNormalized: searchDocumentFor(record),
      tombstoned: false,
    };
    this.sourceSystem = record.sourceSystem;
    this.items.set(projected.id, projected);
    this.indexBarcodes(projected.id, projected.barcodes);
  }

  private indexBarcodes(id: Id, barcodes: ReadonlyArray<string>): void {
    for (const barcode of barcodes) {
      const key = preserveBarcode(barcode);
      const set = this.barcodes.get(key) ?? new Set<Id>();
      set.add(id);
      this.barcodes.set(key, set);
    }
  }

  private unindexBarcodes(id: Id, barcodes: ReadonlyArray<string>): void {
    for (const barcode of barcodes) {
      const key = preserveBarcode(barcode);
      const set = this.barcodes.get(key);
      if (!set) {
        continue;
      }
      set.delete(id);
      if (set.size === 0) {
        this.barcodes.delete(key);
      }
    }
  }
}

export function emptyProjectionMeta(updatedAt: string): CatalogProjectionMeta {
  return {
    projectionVersion: 0,
    sourceVersion: "",
    sourceSystem: "transitional-commerce",
    updatedAt,
    itemCount: 0,
  };
}

export { normalizeSearchText };
