"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BarcodeCollisionDialog } from "./components/BarcodeCollisionDialog";
import { CartPanel } from "./components/CartPanel";
import { CatalogStatusBanners } from "./components/CatalogStatus";
import { CheckoutDialog } from "./components/CheckoutDialog";
import { CustomerPicker } from "./components/CustomerPicker";
import { ProductResults, ProductResultsSkeleton, ProductSearch } from "./components/ProductSearch";
import { SellModal } from "./components/SellModal";
import { SellToast } from "./components/SellToast";
import { VariationDialog } from "./components/VariationDialog";
import { useBarcodeScanner } from "./hooks/useBarcodeScanner";
import { canBeginNewSale, checkoutDialogOpen, type CheckoutSessionView } from "./state/checkoutSession";
import { formatMoneyDisplay, type CheckoutEligibilityView, type QuoteDisplayState } from "./state/quotePresentation";
import type { ElectronicPaymentSessionView, ElectronicTenderView } from "../payments/electronicPaymentView";
import type { TenderAvailabilityView } from "./components/TenderChoice";
import { resolveQuotePresentation } from "./state/quoteRevision";
import { isDigitBarcodeQuery } from "./state/barcodeResolution";
import { bindLocalGeneration } from "./runtime/productDisplayPriceCache";
import { createScanIntentQueue, type ScanIntentStatus } from "./runtime/scanIntentQueue";
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
  applyVisibleSearchResults,
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
  decideNextSaleCustomer,
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
  onTransitionCart?: (
    previous: SellWorkspaceState,
    next: SellWorkspaceState,
    reason: "completed" | "discarded",
  ) => Promise<void>;
  quote?: QuoteDisplayState;
  eligibility?: CheckoutEligibilityView;
  checkoutReady?: boolean;
  checkoutInFlight?: boolean;
  checkoutSession?: CheckoutSessionView;
  onPay?: () => void;
  onRetryQuote?: () => void;
  onConfirmCash?: (cashReceivedText: string) => void;
  onResolveSale?: () => void;
  onResolvePayment?: () => void;
  onRetryFinalize?: () => void;
  onRetryReceipt?: () => void;
  onPrintReceipt?: () => void;
  onCheckoutNewSale?: () => void;
  onDismissCheckout?: () => void;
  onSelectCash?: () => void;
  onBackToPaymentChoice?: () => void;
  onCancelPreparedSale?: () => void;
  onSelectElectronic?: (tender: ElectronicTenderView) => void;
  tenderAvailability?: TenderAvailabilityView;
  electronicSession?: ElectronicPaymentSessionView;
  electronicInFlight?: boolean;
  onResolveElectronic?: () => void;
  onContactManager?: () => void;
  searchCatalog?: (query: string) => Promise<readonly SellProductView[]>;
  resolveBarcodeCatalog?: (barcode: string) => Promise<readonly SellProductView[]>;
  loadVariations?: (parentId: string) => Promise<readonly SellProductView[]>;
  onCustomerQueryChange?: (query: string) => void;
  onWorkspaceChange?: (state: SellWorkspaceState) => void;
  initialCashReceived?: string;
  catalogProjectionGeneration?: number;
  nextSaleCustomer?: CustomerSearchResultView | null;
  onNextSaleCustomerApplied?: (customer: CustomerSearchResultView) => void;
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
  onTransitionCart,
  quote,
  eligibility,
  checkoutReady = false,
  checkoutInFlight = false,
  checkoutSession,
  onPay,
  onRetryQuote,
  onConfirmCash,
  onResolveSale,
  onResolvePayment,
  onRetryFinalize,
  onRetryReceipt,
  onPrintReceipt,
  onCheckoutNewSale,
  onDismissCheckout,
  onSelectCash,
  onBackToPaymentChoice,
  onCancelPreparedSale,
  onSelectElectronic,
  tenderAvailability,
  electronicSession,
  electronicInFlight = false,
  onResolveElectronic,
  onContactManager,
  searchCatalog,
  resolveBarcodeCatalog,
  loadVariations,
  onCustomerQueryChange,
  onWorkspaceChange,
  initialCashReceived,
  catalogProjectionGeneration,
  nextSaleCustomer,
  onNextSaleCustomerApplied,
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
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [cartTransitioning, setCartTransitioning] = useState(false);
  const [variationLoading, setVariationLoading] = useState(false);
  const [variationFailure, setVariationFailure] = useState<{ cartId: string; product: SellProductView } | null>(null);
  const variationRequestRef = useRef(false);
  const searchSeq = useRef(0);
  const scanRuntimeRef = useRef({ onBarcodeScanned, cartId: state.cartId });
  const [scanStatus, setScanStatus] = useState<ScanIntentStatus>({ pendingCount: 0, failed: null });
  const [scanCommitId, setScanCommitId] = useState(0);
  const [scanQueue] = useState(() => createScanIntentQueue<readonly SellProductView[]>());
  const observedProjectionGenerationRef = useRef<number | undefined>(undefined);
  const completedSaleRotationRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    scanQueue.start();
    return () => scanQueue.stop();
  }, [scanQueue]);

  useEffect(() => {
    onWorkspaceChange?.(state);
  }, [onWorkspaceChange, state]);

  useEffect(() => {
    if (!checkoutSession?.saleCompleted) {
      return;
    }
    const completedToken = checkoutSession.transactionId ?? checkoutSession.receipt?.transactionId;
    if (!completedToken || completedSaleRotationRef.current === completedToken) {
      return;
    }

    const previous = state;
    const next = applyNewSale(previous, catalog, deps);
    completedSaleRotationRef.current = completedToken;
    scanQueue.pause();
    setCartTransitioning(true);

    void (async () => {
      try {
        await onTransitionCart?.(previous, next, "completed");
        setState((current) => (current.cartId === previous.cartId ? next : current));
      } catch {
        completedSaleRotationRef.current = null;
      } finally {
        setCartTransitioning(false);
      }
    })();
  }, [
    catalog,
    checkoutSession?.receipt?.transactionId,
    checkoutSession?.saleCompleted,
    checkoutSession?.transactionId,
    deps,
    onTransitionCart,
    scanQueue,
    state,
  ]);

  useEffect(() => {
    const decision = decideNextSaleCustomer({
      next: nextSaleCustomer,
      lineCount: state.lines.length,
      selectedCustomerId: state.selectedCustomer?.id,
    });
    if (decision === "idle" || decision === "pending" || !nextSaleCustomer) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (decision === "consume") {
        onNextSaleCustomerApplied?.(nextSaleCustomer);
        return;
      }
      setState((current) => {
        if (current.lines.length > 0 || current.selectedCustomer?.id === nextSaleCustomer.id) {
          return current;
        }
        return applySelectCustomer(current, nextSaleCustomer);
      });
      onNextSaleCustomerApplied?.(nextSaleCustomer);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [nextSaleCustomer, onNextSaleCustomerApplied, state.lines.length, state.selectedCustomer?.id]);

  useEffect(() => {
    const generation = catalogProjectionGeneration ?? 0;
    if (!bindLocalGeneration(observedProjectionGenerationRef, generation)) {
      return;
    }
    if (!searchCatalog) {
      return;
    }
    const query = state.search.query;
    const seq = ++searchSeq.current;
    void searchCatalog(query).then((results) => {
      if (seq !== searchSeq.current) {
        return;
      }
      setState((current) => applyVisibleSearchResults(current, query, results));
    });
  }, [catalogProjectionGeneration, searchCatalog, state.search.query]);

  const displayed: SellWorkspaceState = {
    ...state,
    catalogAvailability: catalogAvailability ?? state.catalogAvailability,
    draftStatus: draftStatus ?? state.draftStatus,
    search: searchStatus ? { ...state.search, status: searchStatus } : state.search,
  };

  const modalOpen =
    customerPickerOpen ||
    clearConfirmOpen ||
    displayed.notice?.kind === "chooser" ||
    displayed.notice?.kind === "collision" ||
    Boolean(checkoutSession && checkoutDialogOpen(checkoutSession.stage));
  const catalogMutationAllowed = isCatalogMutationAllowed(displayed.catalogAvailability);
  const scanPaused = modalOpen || !catalogMutationAllowed || cartTransitioning || checkoutInFlight || variationLoading;

  useLayoutEffect(() => {
    scanRuntimeRef.current = { onBarcodeScanned, cartId: state.cartId };
    scanQueue.setPorts({
      lookup: (barcode) => resolveBarcodeCatalog ? resolveBarcodeCatalog(barcode) : Promise.resolve(catalog),
      apply: (intent, slice) => {
        // Allocate once outside the updater: React may replay a pure update in Strict Mode.
        const lineId = deps.createLineId();
        const scanDeps = { ...deps, createLineId: () => lineId };
        setState((current) => current.cartId === intent.cartId ? applyBarcodeScan(current, intent.barcode, slice, scanDeps) : current);
        setScanCommitId(intent.id);
      },
      onChange: setScanStatus,
    });
  }, [catalog, deps, onBarcodeScanned, resolveBarcodeCatalog, scanQueue, state.cartId]);

  // Acknowledge after the chooser/collision is committed, so the next intent cannot replace it.
  // Run on each commit to release synchronous handler pauses even if a transition was declined.
  useLayoutEffect(() => {
    scanQueue.setContext(state.cartId, scanPaused);
    scanQueue.acknowledge(scanCommitId);
  });

  const closeNotice = useCallback(() => {
    setState((current) => dismissNotice(current));
  }, []);

  useEffect(() => {
    if (displayed.notice?.kind !== "unknown") {
      return;
    }
    const barcode = displayed.notice.barcode;
    const timer = window.setTimeout(() => {
      setState((current) => (current.notice?.kind === "unknown" && current.notice.barcode === barcode ? dismissNotice(current) : current));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [displayed.notice]);

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
        scanQueue.pause();
        setCustomerPickerOpen(true);
      }
      if (event.key === "Escape") {
        setCustomerPickerOpen(false);
        setClearConfirmOpen(false);
        setState((current) => (dismissNotice(current)));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scanQueue]);

  const scanBarcode = useCallback(
    (barcode: string) => {
      const runtime = scanRuntimeRef.current;
      if (scanQueue.enqueue(barcode, runtime.cartId)) runtime.onBarcodeScanned?.(barcode);
    },
    [scanQueue],
  );

  useBarcodeScanner(scanBarcode, !scanPaused);

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

  function handleSelectProduct(item: SellProductView) {
    if (!catalogMutationAllowed || variationRequestRef.current) return;
    onSelectProduct?.(item.id);
    if (item.kind === "variable") scanQueue.pause();
    if (item.kind === "variable" && loadVariations) {
      const cartId = state.cartId;
      variationRequestRef.current = true;
      setVariationFailure(null);
      setVariationLoading(true);
      void Promise.resolve().then(() => loadVariations(item.id)).then((variations) => {
        setState((current) => current.cartId === cartId ? applyVariationChooser(current, item, variations) : current);
      }).catch(() => setVariationFailure({ cartId, product: item })).finally(() => {
        variationRequestRef.current = false;
        setVariationLoading(false);
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

  async function handleNewSale() {
    if (cartTransitioning || (checkoutSession && !canBeginNewSale(checkoutSession))) {
      return;
    }

    if (checkoutSession?.saleCompleted) {
      const completedToken = checkoutSession.transactionId ?? checkoutSession.receipt?.transactionId;
      if (completedToken && completedSaleRotationRef.current !== completedToken) {
        const previous = state;
        const next = applyNewSale(previous, catalog, deps);
        completedSaleRotationRef.current = completedToken;
        scanQueue.pause();
        setCartTransitioning(true);
        try {
          await onTransitionCart?.(previous, next, "completed");
          setState((current) => (current.cartId === previous.cartId ? next : current));
        } catch {
          completedSaleRotationRef.current = null;
          return;
        } finally {
          setCartTransitioning(false);
        }
      }
      onCheckoutNewSale?.();
      onNewSale?.();
      setCustomerPickerOpen(false);
      setClearConfirmOpen(false);
      return;
    }

    const previous = state;
    const next = applyNewSale(previous, catalog, deps);
    scanQueue.pause();
    setCartTransitioning(true);
    try {
      await onTransitionCart?.(previous, next, "discarded");
      setState((current) => (current.cartId === previous.cartId ? next : current));
      onCheckoutNewSale?.();
      onNewSale?.();
      setCustomerPickerOpen(false);
      setClearConfirmOpen(false);
    } catch {
      return;
    } finally {
      setCartTransitioning(false);
    }
  }

  function handleClearRequest() {
    if (checkoutSession && !canBeginNewSale(checkoutSession)) {
      return;
    }
    if (displayed.lines.length === 0) {
      handleNewSale();
      return;
    }
    scanQueue.pause();
    setClearConfirmOpen(true);
  }

  function handlePay() {
    // The ref-owned queue updates during the scanner event, before a disabled button can render.
    if (scanQueue.hasPending() || scanQueue.isPaused() || scanPaused || !onPay) return;
    scanQueue.pause();
    try {
      onPay();
    } finally {
      // Even a declined/throwing callback needs a commit to release the temporary handler gate.
      setScanStatus((current) => ({ ...current }));
    }
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

  const newSaleBlocked = cartTransitioning || Boolean(checkoutSession && !canBeginNewSale(checkoutSession));

  return (
    <div className="sell-workspace" id="sell-workspace">
      <h1 className="sr-only">Sell</h1>
      {displayed.notice?.kind === "unknown" ? (
        <SellToast title="Product not found for barcode" detail={displayed.notice.barcode} />
      ) : null}
      {scanStatus.failed ? (
        <div className="banner danger" role="alert">
          <p>Barcode lookup is unavailable. Retry or cancel this scan.</p>
          <p>{scanStatus.failed.barcode}</p>
          <button type="button" className="btn" onClick={() => scanQueue.retry()}>Retry barcode lookup</button>
          <button type="button" className="btn" onClick={() => scanQueue.cancelFailed()}>Cancel pending scan</button>
        </div>
      ) : null}
      {variationFailure?.cartId === state.cartId ? (
        <div className="banner danger" role="alert">
          <p>Variations are unavailable. Retry loading this product.</p>
          <button type="button" className="btn" disabled={!catalogMutationAllowed} onClick={() => handleSelectProduct(variationFailure.product)}>
            Retry variations
          </button>
        </div>
      ) : null}
      <div className="sell-workspace-body" inert={modalOpen ? true : undefined}>
        <CatalogStatusBanners availability={displayed.catalogAvailability} />
        <div className="sell-layout">
          <section className="sell-products" aria-label="Products">
            <ProductSearch
              query={displayed.search.query}
              onQueryChange={handleQueryChange}
              onSearchSubmit={handleSearchSubmit}
            />
            <div className="products-meta">
              <div>
                <strong>Products</strong>
                <span className="muted"> · {displayed.search.results.length} shown</span>
              </div>
              {displayed.draftStatus.retainedLocally ? (
                <span className="products-meta-draft" role="status">
                  Saved on this device
                </span>
              ) : null}
            </div>
            {loading ? <ProductResultsSkeleton /> : null}
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
            onOpenCustomers={() => { scanQueue.pause(); setCustomerPickerOpen(true); }}
            onClear={handleClearRequest}
            onIncrement={(lineId) => setState((current) => (applyQuantityIncrement(current, lineId)))}
            onDecrement={(lineId) => setState((current) => (applyQuantityDecrement(current, lineId)))}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemove}
            onCloseMobile={() => setState((current) => (applyMobileCartOpen(current, false)))}
            quote={presentedQuote.quote}
            eligibility={presentedQuote.eligibility}
            checkoutReady={checkoutReady}
            checkoutInFlight={checkoutInFlight}
            scanPending={scanStatus.pendingCount > 0}
            selectionPending={variationLoading}
            clearDisabled={newSaleBlocked}
            onPay={handlePay}
            onRetryQuote={onRetryQuote}
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
      {clearConfirmOpen ? (
        <SellModal titleId="clear-sale-title" onClose={() => setClearConfirmOpen(false)}>
          <h2 id="clear-sale-title">Clear this sale?</h2>
          <p className="muted">Items in the cart will be removed. Your shift stays open.</p>
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={() => setClearConfirmOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={handleNewSale}>
              Clear sale
            </button>
          </div>
        </SellModal>
      ) : null}
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
          inFlight={checkoutInFlight || cartTransitioning}
          onConfirmCash={(value) => onConfirmCash?.(value)}
          onResolveSale={() => onResolveSale?.()}
          onResolvePayment={() => onResolvePayment?.()}
          onRetryFinalize={() => onRetryFinalize?.()}
          onRetryReceipt={() => onRetryReceipt?.()}
          onPrint={() => onPrintReceipt?.()}
          onNewSale={handleNewSale}
          onDismiss={() => onDismissCheckout?.()}
          onSelectCash={onSelectCash}
          onBackToPaymentChoice={onBackToPaymentChoice}
          onCancelPreparedSale={onCancelPreparedSale}
          onSelectElectronic={onSelectElectronic}
          tenderAvailability={tenderAvailability}
          electronicSession={electronicSession}
          electronicInFlight={electronicInFlight}
          onResolveElectronic={onResolveElectronic}
          onContactManager={onContactManager}
          initialCashReceived={initialCashReceived}
        />
      ) : null}
    </div>
  );
}
