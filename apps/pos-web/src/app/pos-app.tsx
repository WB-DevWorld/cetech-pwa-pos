"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ReturnsRuntimeScreen, createReceiptBackedSaleLookup } from "./returns-runtime";
import { AppShell, POS_ROUTE_HREFS, type PosRoute } from "../ui/shell";
import {
  CASHIER_SEED_LOCATION_ID,
  createCartDraftStore,
  createLocalCatalogPort,
  createLocalCustomerPort,
  ensureCashierLocalSeed,
  openPosLocalDatabase,
  recallActiveCartId,
  rememberActiveCartId,
} from "../local";

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
  const readOnline = useCallback(() => online, [online]);

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

  useEffect(() => {
    void (async () => {
      await ensureCashierLocalSeed();
      const db = openPosLocalDatabase();
      const checkout = createBrowserCashCheckoutPorts({ scope: LOCAL_CHECKOUT_SCOPE, fetchImpl });
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
      });
    })();
  }, [fetchImpl]);

  const returns = useMemo(() => createBrowserReturnPort({ fetchImpl }), [fetchImpl]);
  const register = useMemo(() => createBrowserRegisterPort({ fetchImpl }), [fetchImpl]);
  const lookup = useMemo(() => createReceiptBackedSaleLookup({ fetchImpl }), [fetchImpl]);

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
          <SellRuntimeScreen {...ports} online={readOnline} />
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
