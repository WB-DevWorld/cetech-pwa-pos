"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarcodeCollisionDialog } from "./components/BarcodeCollisionDialog";
import { CartPanel } from "./components/CartPanel";
import { CatalogStatusBanners } from "./components/CatalogStatus";
import { CheckoutDialog } from "./components/CheckoutDialog";
import { CustomerPicker } from "./components/CustomerPicker";
import { ProductResults, ProductSearch } from "./components/ProductSearch";
import { VariationDialog } from "./components/VariationDialog";
import { useBarcodeScanner } from "./hooks/useBarcodeScanner";
import { canBeginNewSale, checkoutDialogOpen, type CheckoutSessionView } from "./state/checkoutSession";
import { formatMoneyDisplay, type CheckoutEligibilityView, type QuoteDisplayState } from "./state/quotePresentation";
import type { ElectronicPaymentSessionView, ElectronicTenderView } from "../payments/electronicPaymentView";
import { resolveQuotePresentation } from "./state/quoteRevision";
import { isDigitBarcodeQuery } from "./state/barcodeResolution";
import type {
  CatalogAvailability,
  CatalogSearchState,
  CustomerSearchResultView,
  DraftStatusView,
  SellProductView,
  SellWorkspaceState,
} from "./state/sellView";
import {
  applyBarcodeScan,
  applyCatalogSearchResults,
  applyClearCustomer,
  applyMobileCartOpen,
  applyNameSearch,
  applyNewSale,
  applyProductSelect,
  applyQuantityChange,
  applyQuantityDecrement,
  applyQuantityIncrement,
  applyRemoveLine,
  applySearchQuery,
  applySelectCustomer,
  applyVariationChooser,
  applyVariationSelect,
  catalogMutationAllowed as isCatalogMutationAllowed,
  createSellWorkspace,
  dismissNotice,
  type SellWorkspaceDeps,
} from "./state/sellWorkspace";

function defaultDeps(): SellWorkspaceDeps {
  return {
    createCartId: () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `cart-${Date.now()}`),
    createLineId: () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `line-${Date.now()}-${Math.random()}`),
  };
}

export type SellScreenProps = {
  catalog: readonly SellProductView[];
  customers?: readonly CustomerSearchResultView[];
  initialState?: SellWorkspaceState;
  catalogAvailability?: CatalogAvailability;
  draftStatus?: DraftStatusView;
  searchStatus?: CatalogSearchState["status"];
  createCartId?: () => string;
  createLineId?: () => string;
  onSearch?: (query: string) => void;
  onBarcodeScanned?: (barcode: string) => void;
  onSelectProduct?: (id: string) => void;
  onSelectVariation?: (id: string) => void;
  onChangeQuantity?: (lineId: string, quantity: string) => void;
  onRemoveLine?: (lineId: string) => void;
  onSelectCustomer?: (customerId: string) => void;
  onClearCustomer?: () => void;
  onNewSale?: () => void;
  quote?: QuoteDisplayState;
  eligibility?: CheckoutEligibilityView;
  checkoutReady?: boolean;
  checkoutInFlight?: boolean;
  checkoutSession?: CheckoutSessionView;
  onPay?: () => void;
  onConfirmCash?: (cashReceivedText: string) => void;
  onResolveSale?: () => void;
  onResolvePayment?: () => void;
  onRetryFinalize?: () => void;
  onRetryReceipt?: () => void;
  onPrintReceipt?: () => void;
  onCheckoutNewSale?: () => void;
  onDismissCheckout?: () => void;
  electronicSession?: ElectronicPaymentSessionView;
  electronicInFlight?: boolean;
  electronicTender?: ElectronicTenderView;
  onElectronicTenderChange?: (tender: ElectronicTenderView) => void;
  onPresentElectronic?: () => void;
  onResolveElectronic?: () => void;
  onContinueWaitingElectronic?: () => void;
  onContactManager?: () => void;
  searchCatalog?: (query: string) => Promise<readonly SellProductView[]>;
  resolveBarcodeCatalog?: (barcode: string) => Promise<readonly SellProductView[]>;
  loadVariations?: (parentId: string) => Promise<readonly SellProductView[]>;
  onCustomerQueryChange?: (query: string) => void;
  onWorkspaceChange?: (state: SellWorkspaceState) => void;
};

export function SellScreen({
  catalog,
  customers = [],
  initialState,
  catalogAvailability,
  draftStatus,
  searchStatus,
  createCartId,
  createLineId,
  onSearch,
  onBarcodeScanned,
  onSelectProduct,
  onSelectVariation,
  onChangeQuantity,
  onRemoveLine,
  onSelectCustomer,
  onClearCustomer,
  onNewSale,
  quote,
  eligibility,
  checkoutReady = false,
  checkoutInFlight = false,
  checkoutSession,
  onPay,
  onConfirmCash,
  onResolveSale,
  onResolvePayment,
  onRetryFinalize,
  onRetryReceipt,
  onPrintReceipt,
  onCheckoutNewSale,
  onDismissCheckout,
  electronicSession,
  electronicInFlight = false,
  electronicTender,
  onElectronicTenderChange,
  onPresentElectronic,
  onResolveElectronic,
  onContinueWaitingElectronic,
  onContactManager,
  searchCatalog,
  resolveBarcodeCatalog,
  loadVariations,
  onCustomerQueryChange,
  onWorkspaceChange,
}: SellScreenProps) {
  const deps = useMemo<SellWorkspaceDeps>(
    () => ({
      createCartId: createCartId ?? defaultDeps().createCartId,
      createLineId: createLineId ?? defaultDeps().createLineId,
    }),
    [createCartId, createLineId],
  );
  const [state, setState] = useState(() => initialState ?? createSellWorkspace(deps, catalog));
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const searchSeq = useRef(0);
  const barcodeSeq = useRef(0);

  useEffect(() => {
    onWorkspaceChange?.(state);
  }, [onWorkspaceChange, state]);

  const displayed: SellWorkspaceState = {
    ...state,
    catalogAvailability: catalogAvailability ?? state.catalogAvailability,
    draftStatus: draftStatus ?? state.draftStatus,
    search: searchStatus ? { ...state.search, status: searchStatus } : state.search,
  };

  const modalOpen =
    customerPickerOpen ||
    displayed.notice?.kind === "chooser" ||
    displayed.notice?.kind === "collision" ||
    Boolean(checkoutSession && checkoutDialogOpen(checkoutSession.stage));
  const catalogMutationAllowed = isCatalogMutationAllowed(displayed.catalogAvailability);

  const closeNotice = useCallback(() => {
    setState((current) => dismissNotice(current));
  }, []);

  const closeCustomerPicker = useCallback(() => {
    setCustomerPickerOpen(false);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (document.querySelector(".sell-dialog[open]")) {
        return;
      }
      if (event.key === "F2" || (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey))) {
        event.preventDefault();
        document.getElementById("product-search")?.focus();
      }
      if (event.key === "F4") {
        event.preventDefault();
        setCustomerPickerOpen(true);
      }
      if (event.key === "Escape") {
        setCustomerPickerOpen(false);
        setState((current) => (dismissNotice(current)));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const scanBarcode = useCallback(
    (barcode: string) => {
      if (!catalogMutationAllowed) return;
      onBarcodeScanned?.(barcode);
      const seq = ++barcodeSeq.current;
      void (async () => {
        const slice = resolveBarcodeCatalog ? await resolveBarcodeCatalog(barcode) : catalog;
        if (seq !== barcodeSeq.current) return;
        setState((current) => (applyBarcodeScan(current, barcode, slice, deps)));
      })();
    },
    [catalog, catalogMutationAllowed, deps, onBarcodeScanned, resolveBarcodeCatalog],
  );

  useBarcodeScanner(scanBarcode, !modalOpen && catalogMutationAllowed);

  function handleQueryChange(query: string) {
    onSearch?.(query);
    if (!searchCatalog) {
      setState((current) => (applySearchQuery(current, query, catalog)));
      return;
    }
    const seq = ++searchSeq.current;
    setState((current) => (applyCatalogSearchResults(current, query, current.search.results, "loading")));
    void searchCatalog(query).then((results) => {
      if (seq !== searchSeq.current) return;
      setState((current) => (applyCatalogSearchResults(current, query, results, "ready")));
    });
  }

  function handleSearchSubmit(query: string) {
    const exact = query.trim();
    if (!exact) return;
    onSearch?.(query);
    if (isDigitBarcodeQuery(query)) {
      scanBarcode(query.trim());
      return;
    }
    if (!searchCatalog) {
      setState((current) => (applyNameSearch(current, query, catalog)));
      return;
    }
    const seq = ++searchSeq.current;
    void searchCatalog(query).then((results) => {
      if (seq !== searchSeq.current) return;
      setState((current) => (applyCatalogSearchResults(current, query, results, "ready")));
    });
  }

  function handleScan(query: string) {
    if (!catalogMutationAllowed) return;
    if (query.trim().length === 0) return;
    scanBarcode(query.trim());
  }

  function handleSelectProduct(item: SellProductView) {
    if (!catalogMutationAllowed) return;
    onSelectProduct?.(item.id);
    if (item.kind === "variable" && loadVariations) {
      void loadVariations(item.id).then((variations) => {
        setState((current) => (applyVariationChooser(current, item, variations)));
      });
      return;
    }
    setState((current) => (applyProductSelect(current, item, catalog, deps)));
  }

  function handleSelectVariation(variation: SellProductView) {
    if (!catalogMutationAllowed) return;
    onSelectVariation?.(variation.id);
    setState((current) => (applyVariationSelect(current, variation, deps)));
  }

  function handleQuantityChange(lineId: string, quantity: string) {
    onChangeQuantity?.(lineId, quantity);
    setState((current) => (applyQuantityChange(current, lineId, quantity)));
  }

  function handleRemove(lineId: string) {
    onRemoveLine?.(lineId);
    setState((current) => (applyRemoveLine(current, lineId)));
  }

  function handleSelectCustomer(customer: CustomerSearchResultView) {
    onSelectCustomer?.(customer.id);
    setState((current) => (applySelectCustomer(current, customer)));
    setCustomerPickerOpen(false);
  }

  function handleClearCustomer() {
    onClearCustomer?.();
    setState((current) => (applyClearCustomer(current)));
    setCustomerPickerOpen(false);
  }

  function handleNewSale() {
    if (checkoutSession && !canBeginNewSale(checkoutSession)) {
      return;
    }
    onCheckoutNewSale?.();
    onNewSale?.();
    setCustomerPickerOpen(false);
    setState((current) => (applyNewSale(current, catalog, deps)));
  }

  const itemCount = displayed.lines.length;
  const loading = displayed.search.status === "loading";
  const searchError = displayed.search.status === "error";
  const catalogBlocked = displayed.catalogAvailability === "unavailable";
  const presentedQuote = useMemo(
    () =>
      resolveQuotePresentation({
        quote,
        eligibility,
        cartRevision: displayed.cartRevision,
      }),
    [quote, eligibility, displayed.cartRevision],
  );

  return (
    <div className="sell-workspace" id="sell-workspace">
      <div inert={modalOpen ? true : undefined}>
        <div className="page-head">
          <div>
            <h1>Sell</h1>
            <p>Scan or search for a product</p>
          </div>
        </div>
        <CatalogStatusBanners availability={displayed.catalogAvailability} draftStatus={displayed.draftStatus} />
        {displayed.notice?.kind === "unknown" ? (
          <div className="banner danger" role="alert">
            Product not found for barcode {displayed.notice.barcode}.
          </div>
        ) : null}
        <div className="sell-layout">
          <section className="sell-products" aria-label="Products">
            <ProductSearch
              query={displayed.search.query}
              onQueryChange={handleQueryChange}
              onSearchSubmit={handleSearchSubmit}
              onScan={handleScan}
              scanDisabled={!catalogMutationAllowed}
            />
            <div className="products-meta">
              <strong>Products</strong>
              <span className="muted"> · {displayed.search.results.length} shown</span>
            </div>
            {loading ? <p className="muted">Loading products…</p> : null}
            {searchError ? (
              <div className="banner danger" role="alert">
                Product search is unavailable. Try again.
              </div>
            ) : null}
            {catalogBlocked ? (
              <p className="muted">{"Products couldn't be loaded. Check the connection and try again."}</p>
            ) : loading || searchError ? null : (
              <ProductResults items={displayed.search.results} onSelect={handleSelectProduct} />
            )}
          </section>
          <CartPanel
            revision={displayed.cartRevision}
            lines={displayed.lines}
            customer={displayed.selectedCustomer}
            mobileOpen={displayed.mobileCartOpen}
            onOpenCustomers={() => setCustomerPickerOpen(true)}
            onNewSale={handleNewSale}
            onIncrement={(lineId) => setState((current) => (applyQuantityIncrement(current, lineId)))}
            onDecrement={(lineId) => setState((current) => (applyQuantityDecrement(current, lineId)))}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemove}
            onCloseMobile={() => setState((current) => (applyMobileCartOpen(current, false)))}
            quote={presentedQuote.quote}
            eligibility={presentedQuote.eligibility}
            checkoutReady={checkoutReady}
            checkoutInFlight={checkoutInFlight}
            newSaleDisabled={Boolean(checkoutSession && !canBeginNewSale(checkoutSession))}
            onPay={onPay}
          />
          <div className="mobile-cart-bar">
            <div>
              <strong>
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </strong>
              <div className="muted">
                {presentedQuote.quote?.status === "confirmed"
                  ? formatMoneyDisplay(presentedQuote.quote.quote.total)
                  : "Checking price…"}
              </div>
            </div>
            <button type="button" className="btn primary" onClick={() => setState((current) => (applyMobileCartOpen(current, true)))}>
              View Cart / Pay
            </button>
          </div>
        </div>
      </div>
      {displayed.notice?.kind === "chooser" ? (
        <VariationDialog
          product={displayed.notice.product}
          variations={displayed.notice.variations}
          onSelect={handleSelectVariation}
          onCancel={closeNotice}
        />
      ) : null}
      {displayed.notice?.kind === "collision" ? (
        <BarcodeCollisionDialog
          barcode={displayed.notice.barcode}
          matches={displayed.notice.matches}
          onSelect={handleSelectProduct}
          onCancel={closeNotice}
        />
      ) : null}
      {customerPickerOpen ? (
        <CustomerPicker
          customers={customers}
          selectedId={displayed.selectedCustomer?.id ?? null}
          onSelect={handleSelectCustomer}
          onClear={handleClearCustomer}
          onCancel={closeCustomerPicker}
          onQueryChange={onCustomerQueryChange}
        />
      ) : null}
      {checkoutSession && checkoutDialogOpen(checkoutSession.stage) ? (
        <CheckoutDialog
          session={checkoutSession}
          inFlight={checkoutInFlight}
          onConfirmCash={(value) => onConfirmCash?.(value)}
          onResolveSale={() => onResolveSale?.()}
          onResolvePayment={() => onResolvePayment?.()}
          onRetryFinalize={() => onRetryFinalize?.()}
          onRetryReceipt={() => onRetryReceipt?.()}
          onPrint={() => onPrintReceipt?.()}
          onNewSale={handleNewSale}
          onDismiss={() => onDismissCheckout?.()}
          electronicSession={electronicSession}
          electronicInFlight={electronicInFlight}
          electronicTender={electronicTender}
          onElectronicTenderChange={onElectronicTenderChange}
          onPresentElectronic={onPresentElectronic}
          onResolveElectronic={onResolveElectronic}
          onContinueWaitingElectronic={onContinueWaitingElectronic}
          onContactManager={onContactManager}
        />
      ) : null}
    </div>
  );
}
