"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CartDraftStore, CatalogPort, CustomerPort, PricingPort } from "../../../../../../docs/contracts/ports";
import { SellScreen } from "../SellScreen";
import type { CatalogAvailability, CustomerSearchResultView, SellProductView, SellWorkspaceState } from "../state/sellView";
import { lookupBarcodeViews, lookupVariations, searchCatalogViews } from "./catalogLookup";
import { customerViewFromSummary, workspaceToCartDraft } from "./mapCartDraft";
import { restoreSellWorkspace } from "./restoreWorkspace";
import { useCartQuote } from "./useCartQuote";

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
  const [availability, setAvailability] = useState<CatalogAvailability>("fresh");
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
        availability: availabilityFromNetwork(connectedNow, !browse.ok, views.length > 0),
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
  }, [catalog, createCartId, createLineId, customersPort, drafts, locationId, recallCartId, rememberCartId]);

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
        setAvailability((current) => availabilityFromNetwork(online(), true, current !== "unavailable"));
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
          availabilityFromNetwork(online(), true, browseCatalog.length > 0 || current === "offline_cached"),
        );
        return browseCatalog;
      }
      setSearchStatus("ready");
      setAvailability(availabilityFromNetwork(online(), false, result.items.length > 0 || browseCatalog.length > 0));
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
        <p className="muted">Loading catalog…</p>
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
      />
    </div>
  );
}
