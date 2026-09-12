export { SellScreen, type SellScreenProps } from "./SellScreen";
export { CartPanel } from "./components/CartPanel";
export { ProductSearch, ProductCard, ProductResults } from "./components/ProductSearch";
export { VariationDialog } from "./components/VariationDialog";
export { BarcodeCollisionDialog } from "./components/BarcodeCollisionDialog";
export { CustomerPicker } from "./components/CustomerPicker";
export { CatalogStatusBanners, catalogAvailabilityCopy } from "./components/CatalogStatus";
export {
  type SellProductView,
  type CartLineView,
  type CustomerSearchResultView,
  type CatalogSearchState,
  type DraftStatusView,
  type CatalogAvailability,
  type BarcodeNotice,
  type SellWorkspaceState,
  type SellableKind,
  type StockPresentation,
} from "./state/sellView";
export {
  createSellWorkspace,
  applySearchQuery,
  applyNameSearch,
  applyBarcodeScan,
  applyProductSelect,
  applyVariationSelect,
  applyQuantityChange,
  applyRemoveLine,
  applySelectCustomer,
  applyClearCustomer,
  applyNewSale,
  applyCatalogAvailability,
  applyDraftStatus,
  catalogMutationAllowed,
  type SellWorkspaceDeps,
} from "./state/sellWorkspace";
export { resolveBarcode, childrenOf, isDigitBarcodeQuery } from "./state/barcodeResolution";
export { addOrIncrementLine, setLineQuantity, removeLine, emptyCart } from "./state/cartState";
export { addQuantity, incrementQuantity, decrementQuantity, parseQuantityInput } from "./state/quantity";
export { commitQuantityDraft, holdQuantityDraft } from "./state/quantityDraft";
export { appendBarcodeKey, createBarcodeBuffer } from "./state/barcodeBuffer";

/** Stylesheet WS3 should import from `src/app` layout when mounting Sell. FE-03 does not own route files. */
export const SELL_STYLESHEETS = ["@/features/sell/sell.css"] as const;
