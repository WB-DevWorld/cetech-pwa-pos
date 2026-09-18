"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CartDraftStore, CatalogPort, CheckoutUseCases, CustomerPort, PaymentPort, PricingPort, PrintPort, ReceiptPort, SalesPort } from "../../../../../../docs/contracts/ports";
import { SellScreen } from "../SellScreen";
import { useElectronicPayment } from "../../payments/useElectronicPayment";
import type { ElectronicTenderView } from "../../payments/electronicPaymentView";
import type { CatalogAvailability, CustomerSearchResultView, SellProductView, SellWorkspaceState } from "../state/sellView";
import { lookupBarcodeViews, lookupVariations, searchCatalogViews } from "./catalogLookup";
import { customerViewFromSummary, workspaceToCartDraft } from "./mapCartDraft";
import { restoreSellWorkspace } from "./restoreWorkspace";
import { useCartQuote } from "./useCartQuote";
import { useCashCheckout, type CashCheckoutPorts } from "./useCashCheckout";
import type { CashCheckoutScope } from "./cashCheckoutController";

export type SellSessionPorts = {
  readonly catalog: CatalogPort;
  readonly customers: CustomerPort;
  readonly drafts: CartDraftStore;
  readonly rememberCartId: (cartId: string) => Promise<void>;
  readonly recallCartId: () => Promise<string | null>;
  readonly locationId: string;
  readonly now?: () => Date;
  readonly online?: () => boolean;
  readonly createCartId?: () => string;
  readonly createLineId?: () => string;
  readonly pricing?: PricingPort;
  readonly shiftOpen?: boolean;
  readonly checkout?: CheckoutUseCases;
  readonly payments?: Pick<PaymentPort, "confirmCash" | "resolve"> & Partial<Pick<PaymentPort, "initialize">>;
  readonly sales?: Pick<SalesPort, "resolve">;
  readonly receipts?: ReceiptPort;
  readonly printer?: PrintPort;
  readonly checkoutScope?: CashCheckoutScope;
  readonly createCheckoutUuid?: () => string;
  readonly catalogAvailability?: CatalogAvailability;
};

function defaultNow(): Date {
  return new Date();
}

function defaultOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function defaultIdFactory(prefix: string): () => string {
  return () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}`);
}

function availabilityFromNetwork(online: boolean, searchFailed: boolean, hasCache: boolean): CatalogAvailability {
  if (searchFailed && !hasCache) return "unavailable";
  if (!online && hasCache) return "offline_cached";
  if (!online) return "offline";
  if (searchFailed) return "stale";
  return "fresh";
}

function preserveProjectionAvailability(
  current: CatalogAvailability,
  online: boolean,
  searchFailed: boolean,
  hasCache: boolean,
): CatalogAvailability {
  if (current === "unavailable") {
    return "unavailable";
  }
  if (current === "stale" && !searchFailed) {
    return online ? "stale" : "offline_cached";
  }
  return availabilityFromNetwork(online, searchFailed, hasCache);
}

export function SellRuntimeScreen(ports: SellSessionPorts) {
  const fallbackCreateCartId = useMemo(() => defaultIdFactory("cart"), []);
  const fallbackCreateLineId = useMemo(() => defaultIdFactory("line"), []);
  const createCartId = ports.createCartId ?? fallbackCreateCartId;
  const createLineId = ports.createLineId ?? fallbackCreateLineId;
  const now = useMemo(() => ports.now ?? defaultNow, [ports.now]);
  const online = useMemo(() => ports.online ?? defaultOnline, [ports.online]);
  const catalog = ports.catalog;
  const customersPort = ports.customers;
  const drafts = ports.drafts;
  const rememberCartId = ports.rememberCartId;
  const recallCartId = ports.recallCartId;
  const locationId = ports.locationId;
  const nowRef = useRef(now);
  const onlineRef = useRef(online);
  const [ready, setReady] = useState(false);
  const [initialState, setInitialState] = useState<SellWorkspaceState | undefined>(undefined);
  const [browseCatalog, setBrowseCatalog] = useState<readonly SellProductView[]>([]);
  const [customers, setCustomers] = useState<readonly CustomerSearchResultView[]>([]);
  const [searchStatus, setSearchStatus] = useState<SellWorkspaceState["search"]["status"]>("idle");
  const [availability, setAvailability] = useState<CatalogAvailability>(ports.catalogAvailability ?? "fresh");
  const [workspace, setWorkspace] = useState<SellWorkspaceState | undefined>(undefined);
  const [restoreCount, setRestoreCount] = useState(0);
  const connected = online();
  const presentedQuote = useCartQuote({
    pricing: ports.pricing,
    workspace,
    locationId,
    online: connected,
    shiftOpen: ports.shiftOpen ?? true,
    now,
  });
  const checkoutPorts = useMemo<CashCheckoutPorts | undefined>(() => {
    if (!ports.checkout || !ports.payments || !ports.sales || !ports.receipts || !ports.printer || !ports.checkoutScope) {
      return undefined;
    }
    return {
      checkout: ports.checkout,
      payments: ports.payments,
      sales: ports.sales,
      receipts: ports.receipts,
      printer: ports.printer,
      scope: ports.checkoutScope,
      createUuid: ports.createCheckoutUuid,
    };
  }, [
    ports.checkout,
    ports.checkoutScope,
    ports.createCheckoutUuid,
    ports.payments,
    ports.printer,
    ports.receipts,
    ports.sales,
  ]);
  const cashCheckout = useCashCheckout(checkoutPorts);
  const electronicPorts = useMemo(() => {
    if (!ports.payments?.initialize || !ports.payments.resolve) {
      return undefined;
    }
    return {
      payments: {
        initialize: ports.payments.initialize,
        resolve: ports.payments.resolve,
      },
      createUuid: ports.createCheckoutUuid,
    };
  }, [ports.createCheckoutUuid, ports.payments]);
  const electronic = useElectronicPayment(electronicPorts);
  const [electronicTender, setElectronicTender] = useState<ElectronicTenderView>("mobile_money");
  const cashCheckoutRef = useRef(cashCheckout);

  useEffect(() => {
    cashCheckoutRef.current = cashCheckout;
  }, [cashCheckout]);

  useEffect(() => {
    if (electronic.session.status === "verified") {
      void cashCheckoutRef.current.resolvePayment();
    }
  }, [electronic.session.paymentId, electronic.session.status]);

  useEffect(() => {
    nowRef.current = now;
    onlineRef.current = online;
  }, [now, online]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const connectedNow = onlineRef.current();
      const browse = await searchCatalogViews(catalog, "");
      const customerPage = await customersPort.search("");
      const views = browse.ok ? browse.items : [];
      const restored = await restoreSellWorkspace({
        catalog,
        customers: customersPort,
        drafts,
        recallCartId,
        browseCatalog: views,
        deps: { createCartId, createLineId },
        availability:
          ports.catalogAvailability ??
          availabilityFromNetwork(connectedNow, !browse.ok, views.length > 0),
      });
      if (cancelled) return;
      await drafts.save(workspaceToCartDraft(restored, locationId, nowRef.current().toISOString()));
      await rememberCartId(restored.cartId);
      if (cancelled) return;
      setBrowseCatalog(views);
      setCustomers(customerPage.ok ? customerPage.data.map(customerViewFromSummary) : []);
      setAvailability(restored.catalogAvailability);
      setSearchStatus(browse.ok ? "ready" : "error");
      setInitialState(restored);
      setWorkspace(restored);
      setRestoreCount((count) => count + 1);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [catalog, createCartId, createLineId, customersPort, drafts, locationId, ports.catalogAvailability, recallCartId, rememberCartId]);

  const persist = useCallback(
    (state: SellWorkspaceState) => {
      setWorkspace(state);
      void drafts.save(workspaceToCartDraft(state, locationId, now().toISOString()));
      void rememberCartId(state.cartId);
    },
    [drafts, locationId, now, rememberCartId],
  );

  const resolveBarcodeCatalog = useCallback(
    async (barcode: string) => {
      const result = await lookupBarcodeViews(catalog, barcode);
      if (!result.ok) {
        setAvailability((current) =>
          preserveProjectionAvailability(current, online(), true, current !== "unavailable"),
        );
        return [];
      }
      return result.items;
    },
    [catalog, online],
  );

  const searchCatalog = useCallback(
    async (query: string) => {
      setSearchStatus("loading");
      const result = await searchCatalogViews(catalog, query);
      if (!result.ok) {
        setSearchStatus("error");
        setAvailability((current) =>
          preserveProjectionAvailability(
            current,
            online(),
            true,
            browseCatalog.length > 0 || current === "offline_cached" || current === "stale",
          ),
        );
        return browseCatalog;
      }
      setSearchStatus("ready");
      setAvailability((current) =>
        preserveProjectionAvailability(
          current,
          online(),
          false,
          result.items.length > 0 || browseCatalog.length > 0,
        ),
      );
      return result.items;
    },
    [browseCatalog, catalog, online],
  );

  const loadVariations = useCallback(
    async (parentId: string) => {
      const result = await lookupVariations(catalog, parentId);
      return result.ok ? result.items : [];
    },
    [catalog],
  );

  const searchCustomers = useCallback(
    async (query: string) => {
      const result = await customersPort.search(query);
      if (!result.ok) {
        return;
      }
      setCustomers(result.data.map(customerViewFromSummary));
    },
    [customersPort],
  );

  if (!ready || !initialState) {
    return (
      <div className="sell-workspace">
        <p className="muted">Loading products…</p>
      </div>
    );
  }

  return (
    <div data-sell-restore-count={restoreCount}>
      <SellScreen
        catalog={browseCatalog}
        customers={customers}
        initialState={initialState}
        catalogAvailability={availability}
        searchStatus={searchStatus}
        createCartId={createCartId}
        createLineId={createLineId}
        searchCatalog={searchCatalog}
        resolveBarcodeCatalog={resolveBarcodeCatalog}
        loadVariations={loadVariations}
        onCustomerQueryChange={searchCustomers}
        onWorkspaceChange={persist}
        quote={presentedQuote.quote}
        eligibility={presentedQuote.eligibility}
        checkoutReady={cashCheckout.ready}
        checkoutInFlight={cashCheckout.inFlight}
        checkoutSession={cashCheckout.session}
        onPay={() => {
          void cashCheckout.startPrepare(presentedQuote.confirmedQuote);
        }}
        onConfirmCash={(value) => {
          void cashCheckout.confirmCash(value);
        }}
        onResolveSale={() => {
          void cashCheckout.resolveSale();
        }}
        onResolvePayment={() => {
          void cashCheckout.resolvePayment();
        }}
        onRetryFinalize={() => {
          void cashCheckout.retryFinalize();
        }}
        onRetryReceipt={() => {
          void cashCheckout.loadReceipt();
        }}
        onPrintReceipt={() => {
          void cashCheckout.printReceipt();
        }}
        onCheckoutNewSale={() => {
          cashCheckout.resetForNewSale();
          electronic.reset();
        }}
        onDismissCheckout={cashCheckout.dismiss}
        electronicSession={electronic.ready ? electronic.session : undefined}
        electronicInFlight={electronic.inFlight}
        electronicTender={electronicTender}
        onElectronicTenderChange={setElectronicTender}
        onPresentElectronic={
          electronic.ready
            ? () => {
                const transactionId = cashCheckout.session.transactionId;
                if (!transactionId) {
                  return;
                }
                void electronic.present({ transactionId, tender: electronicTender });
              }
            : undefined
        }
        onResolveElectronic={() => {
          void electronic.resolve();
        }}
        onContinueWaitingElectronic={() => {
          void electronic.resolve();
        }}
        onContactManager={() => {
          void electronic.resolve();
        }}
      />
    </div>
  );
}
