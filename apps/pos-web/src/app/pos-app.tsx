"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SellRuntimeScreen, type SellSessionPorts } from "../features/sell";
import { createBrowserPricingPort } from "../features/sell/runtime/pricingClient";
import {
  LOCAL_CHECKOUT_SCOPE,
  createBrowserCashCheckoutPorts,
  createBrowserRegisterPort,
  createBrowserReturnPort,
} from "./checkout-client";
import { RegisterRuntimeScreen } from "./register-runtime";
import { ReturnsRuntimeScreen, createBrowserHistoricReturnSaleLookup } from "./returns-runtime";
import { AppShell, POS_ROUTE_HREFS, type PosRoute } from "../ui/shell";
import { resolveBrowserCatalogSourcePolicy } from "../core/catalog/source-policy";
import {
  CASHIER_SEED_LOCATION_ID,
  CATALOG_REFRESH_MIN_INTERVAL_MS,
  createCartDraftStore,
  createLocalCatalogPort,
  createLocalCustomerPort,
  ensureCashierLocalSeed,
  ensureCatalogProjection,
  openPosLocalDatabase,
  recallActiveCartId,
  rememberActiveCartId,
} from "../local";
import type { CatalogProjectionAvailability } from "../local/catalog-sync";

export function PosApp({
  route,
  fetchImpl,
}: {
  readonly route: PosRoute;
  readonly fetchImpl?: typeof fetch;
}) {
  const router = useRouter();
  return (
    <PosRuntime
      route={route}
      fetchImpl={fetchImpl}
      onNavigate={(next) => router.push(POS_ROUTE_HREFS[next])}
    />
  );
}

export function PosRuntime({
  route,
  fetchImpl,
  onNavigate,
}: {
  readonly route: PosRoute;
  readonly fetchImpl?: typeof fetch;
  readonly onNavigate: (route: PosRoute) => void;
}) {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [ports, setPorts] = useState<SellSessionPorts | null>(null);
  const [projectionAvailability, setProjectionAvailability] = useState<CatalogProjectionAvailability | null>(null);
  const refreshInFlight = useRef(false);
  const readOnline = useCallback(() => online, [online]);
  const policy = useMemo(
    () =>
      resolveBrowserCatalogSourcePolicy({
        hostname: typeof window === "undefined" ? "localhost" : window.location.hostname,
        nodeEnv: process.env.NODE_ENV,
      }),
    [],
  );

  useEffect(() => {
    function sync() {
      setOnline(navigator.onLine);
    }
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const mountPorts = useCallback(
    async (availability: CatalogProjectionAvailability) => {
      const db = openPosLocalDatabase();
      const checkout = createBrowserCashCheckoutPorts({ scope: LOCAL_CHECKOUT_SCOPE, fetchImpl });
      setProjectionAvailability(availability);
      setPorts({
        catalog: createLocalCatalogPort({ db }),
        customers: createLocalCustomerPort({ db }),
        drafts: createCartDraftStore(db),
        rememberCartId: (cartId) => rememberActiveCartId(cartId, db),
        recallCartId: () => recallActiveCartId(db),
        locationId: CASHIER_SEED_LOCATION_ID,
        pricing: createBrowserPricingPort({ fetchImpl }),
        shiftOpen: true,
        checkout: checkout.checkout,
        payments: checkout.payments,
        sales: checkout.sales,
        receipts: checkout.receipts,
        printer: checkout.printer,
        checkoutScope: checkout.scope,
        catalogAvailability: availability,
      });
    },
    [fetchImpl],
  );

  useEffect(() => {
    void (async () => {
      try {
        const synced = await ensureCatalogProjection({
          policy,
          fetchImpl,
          force: true,
        });
        await mountPorts(synced.availability);
      } catch {
        if (policy === "synthetic_permitted") {
          await ensureCashierLocalSeed();
          await mountPorts("fresh");
          return;
        }
        await mountPorts("unavailable");
      }
    })();
  }, [fetchImpl, mountPorts, policy]);

  useEffect(() => {
    async function refresh(force: boolean) {
      if (refreshInFlight.current) {
        return;
      }
      refreshInFlight.current = true;
      try {
        const synced = await ensureCatalogProjection({
          policy,
          fetchImpl,
          force,
          minRefreshIntervalMs: CATALOG_REFRESH_MIN_INTERVAL_MS,
        });
        setProjectionAvailability(synced.availability);
        setPorts((current) =>
          current ? { ...current, catalogAvailability: synced.availability } : current,
        );
      } finally {
        refreshInFlight.current = false;
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        void refresh(false);
      }
    }
    function onOnline() {
      void refresh(false);
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [fetchImpl, policy]);

  const returns = useMemo(() => createBrowserReturnPort({ fetchImpl }), [fetchImpl]);
  const register = useMemo(() => createBrowserRegisterPort({ fetchImpl }), [fetchImpl]);
  const lookup = useMemo(() => createBrowserHistoricReturnSaleLookup({ fetchImpl }), [fetchImpl]);

  return (
    <AppShell
      activeRoute={route}
      registerName="Front Counter 1"
      cashierDisplayName="Staff member"
      shiftOpen
      online={online}
      onNavigate={onNavigate}
    >
      {route === "sell" ? (
        ports ? (
          <>
            {projectionAvailability === "unavailable" ? (
              <p className="muted" role="status">
                Catalog unavailable. Synchronization required.
              </p>
            ) : null}
            <SellRuntimeScreen {...ports} online={readOnline} catalogAvailability={ports.catalogAvailability} />
          </>
        ) : (
          <p className="muted">Loading catalog…</p>
        )
      ) : route === "returns" ? (
        <ReturnsRuntimeScreen returns={returns} lookup={lookup} />
      ) : route === "register" ? (
        <RegisterRuntimeScreen
          register={register}
          registerId={LOCAL_CHECKOUT_SCOPE.registerId}
          deviceId={LOCAL_CHECKOUT_SCOPE.deviceId}
          currency="GHS"
        />
      ) : (
        <section>
          <h1>{labelFor(route)}</h1>
          <p className="muted">This workspace is not part of the R4 Sell runtime.</p>
        </section>
      )}
    </AppShell>
  );
}

function labelFor(route: PosRoute): string {
  return route.charAt(0).toUpperCase() + route.slice(1);
}
