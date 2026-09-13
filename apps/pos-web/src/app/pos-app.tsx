"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SellRuntimeScreen, type SellSessionPorts } from "../features/sell";
import { createBrowserPricingPort } from "../features/sell/runtime/pricingClient";
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

export function PosApp({ route }: { route: PosRoute }) {
  const router = useRouter();
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [ports, setPorts] = useState<SellSessionPorts | null>(null);

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
      setPorts({
        catalog: createLocalCatalogPort({ db }),
        customers: createLocalCustomerPort({ db }),
        drafts: createCartDraftStore(db),
        rememberCartId: (cartId) => rememberActiveCartId(cartId, db),
        recallCartId: () => recallActiveCartId(db),
        locationId: CASHIER_SEED_LOCATION_ID,
        pricing: createBrowserPricingPort(),
        shiftOpen: true,
      });
    })();
  }, []);

  return (
    <AppShell
      activeRoute={route}
      registerName="Front Counter 1"
      cashierDisplayName="Staff member"
      shiftOpen
      online={online}
      onNavigate={(next) => router.push(POS_ROUTE_HREFS[next])}
    >
      {route === "sell" ? (
        ports ? (
          <SellRuntimeScreen {...ports} online={() => online} />
        ) : (
          <p className="muted">Loading catalog…</p>
        )
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
