export type SellableKind = "simple" | "variable" | "variation";

export type StockPresentation = "in_stock" | "low_stock" | "out_of_stock" | "backorder" | "unknown";

export type SellProductView = {
  readonly id: string;
  readonly name: string;
  readonly sku?: string;
  readonly barcodes: readonly string[];
  readonly kind: SellableKind;
  readonly parentId?: string;
  readonly variationLabel?: string;
  readonly stockStatus: StockPresentation;
  /** Advisory catalog display price. Never used as checkout or quote authority. */
  readonly displayPrice?: {
    readonly minor: number;
    readonly currency: string;
  };
};

export type CartLineView = {
  readonly lineId: string;
  readonly catalogItemId: string;
  readonly variationId?: string;
  readonly name: string;
  readonly variationLabel?: string;
  readonly sku?: string;
  readonly scannedBarcode?: string;
  readonly quantity: string;
};

export type CustomerSearchResultView = {
  readonly id: string;
  readonly displayName: string;
  readonly kind?: "retail" | "b2b";
  readonly company?: string;
  readonly phoneMasked?: string;
};

export type CatalogAvailability = "fresh" | "stale" | "offline" | "offline_cached" | "unavailable";

export type DraftStatusView = {
  readonly retainedLocally: boolean;
};

export type CatalogSearchState = {
  readonly query: string;
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly results: readonly SellProductView[];
};

export type BarcodeNotice =
  | { readonly kind: "unknown"; readonly barcode: string }
  | { readonly kind: "collision"; readonly barcode: string; readonly matches: readonly SellProductView[] }
  | { readonly kind: "chooser"; readonly product: SellProductView; readonly variations: readonly SellProductView[] };

export type SellWorkspaceState = {
  readonly cartId: string;
  readonly cartRevision: number;
  readonly lines: readonly CartLineView[];
  readonly selectedCustomer: CustomerSearchResultView | null;
  readonly commercialInvalidated: boolean;
  readonly search: CatalogSearchState;
  readonly notice: BarcodeNotice | null;
  readonly catalogAvailability: CatalogAvailability;
  readonly draftStatus: DraftStatusView;
  readonly mobileCartOpen: boolean;
};
