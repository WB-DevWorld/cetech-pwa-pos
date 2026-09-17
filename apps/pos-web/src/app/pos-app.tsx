"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SellRuntimeScreen, type SellSessionPorts } from "../features/sell";
import { createBrowserPricingPort } from "../features/sell/runtime/pricingClient";
import {
  createBrowserCashCheckoutPorts,
  createBrowserRegisterPort,
  createBrowserReturnPort,
} from "./checkout-client";
import { RegisterRuntimeScreen } from "./register-runtime";
import { ReturnsRuntimeScreen, createBrowserHistoricReturnSaleLookup } from "./returns-runtime";
import { StaffAuthGate } from "./staff-auth-gate";
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
import {
  createBffStaffSessionGateway,
  createPublicSupabaseStaffAuthProvider,
  createStaffIdentityPort,
  createStaffRuntimeController,
  readOrCreateLocalDeviceId,
  type StaffRuntimeAuthority,
  type StaffRuntimeController,
} from "../core/identity";
import type { AuthNoticeState } from "../features/auth";
import type { Shift } from "../../../../docs/contracts/domain.generated";

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
  const [authority, setAuthority] = useState<StaffRuntimeAuthority>(() => ({
    status: "restoring",
    session: null,
    assignedLocationIds: [],
    assignedRegisterIds: [],
    register: null,
    shift: null,
    shiftOpen: false,
  }));
  const readOnline = useCallback(() => online, [online]);

  const registerPort = useMemo(() => createBrowserRegisterPort({ fetchImpl }), [fetchImpl]);
  const runtime = useMemo<StaffRuntimeController>(
    () =>
      createStaffRuntimeController({
        gateway: createBffStaffSessionGateway({ fetchImpl }),
        auth: createPublicSupabaseStaffAuthProvider({ fetchImpl }),
        registers: registerPort,
      }),
    [fetchImpl, registerPort],
  );

  useEffect(() => {
    return runtime.subscribe(() => {
      setAuthority(runtime.getState());
    });
  }, [runtime]);

  useEffect(() => {
    void runtime.restore();
  }, [runtime]);

  useEffect(() => {
    function sync() {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        void runtime.refreshRegister();
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        void runtime.refreshRegister();
      }
    }
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runtime]);

  useEffect(() => {
    if (authority.status !== "ready" || !authority.session) {
      return;
    }
    let cancelled = false;
    const locationId =
      authority.register?.locationId ?? authority.assignedLocationIds[0] ?? CASHIER_SEED_LOCATION_ID;
    const registerId = authority.register?.id;
    const shiftId = authority.shiftOpen ? authority.shift?.id : undefined;
    const deviceId = authority.shift?.deviceId ?? readOrCreateLocalDeviceId();
    const checkout = createBrowserCashCheckoutPorts({
      fetchImpl,
      ...(registerId && shiftId ? { scope: { registerId, shiftId, deviceId } } : {}),
    });
    void (async () => {
      await ensureCashierLocalSeed();
      if (cancelled) {
        return;
      }
      const db = openPosLocalDatabase();
      setPorts({
        catalog: createLocalCatalogPort({ db }),
        customers: createLocalCustomerPort({ db }),
        drafts: createCartDraftStore(db),
        rememberCartId: (cartId) => rememberActiveCartId(cartId, db),
        recallCartId: () => recallActiveCartId(db),
        locationId,
        pricing: createBrowserPricingPort({ fetchImpl }),
        shiftOpen: authority.shiftOpen,
        checkout: checkout.checkout,
        payments: checkout.payments,
        sales: checkout.sales,
        receipts: checkout.receipts,
        printer: checkout.printer,
        checkoutScope: registerId && shiftId ? checkout.scope : undefined,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authority.status,
    authority.session,
    authority.register,
    authority.shift,
    authority.shiftOpen,
    authority.assignedLocationIds,
    fetchImpl,
  ]);

  const returns = useMemo(() => createBrowserReturnPort({ fetchImpl }), [fetchImpl]);
  const lookup = useMemo(() => createBrowserHistoricReturnSaleLookup({ fetchImpl }), [fetchImpl]);
  const identity = useMemo(
    () =>
      createStaffIdentityPort({
        gateway: createBffStaffSessionGateway({ fetchImpl }),
        correlationId: () => crypto.randomUUID(),
        localWork: { drafts: [], journal: [] },
      }),
    [fetchImpl],
  );

  const onShiftChange = useCallback(
    (shift: Shift | null) => {
      runtime.applyShift(shift);
    },
    [runtime],
  );

  const authNotice: AuthNoticeState =
    authority.status === "expired"
      ? "expired"
      : authority.status === "unauthorized"
        ? "unauthorized"
        : authority.status === "restoring"
          ? "loading"
          : "signed_out";

  if (authority.status !== "ready" || !authority.session) {
    return (
      <StaffAuthGate
        noticeState={authNotice}
        busy={authority.status === "restoring"}
        errorMessage={authority.errorMessage}
        onSignIn={(request) => {
          void runtime.signIn(request);
        }}
      />
    );
  }

  const registerId = authority.register?.id;
  const deviceId = authority.shift?.deviceId ?? readOrCreateLocalDeviceId();

  return (
    <AppShell
      activeRoute={route}
      registerName={authority.register?.name ?? "No register"}
      cashierDisplayName={authority.session.displayName}
      shiftOpen={authority.shiftOpen}
      online={online}
      onNavigate={onNavigate}
      onLock={() => {
        void (async () => {
          await identity.signOut();
          await runtime.signOut();
        })();
      }}
    >
      {route === "sell" ? (
        ports ? (
          <SellRuntimeScreen {...ports} shiftOpen={authority.shiftOpen} online={readOnline} />
        ) : (
          <p className="muted">Loading catalog…</p>
        )
      ) : route === "returns" ? (
        <ReturnsRuntimeScreen returns={returns} lookup={lookup} />
      ) : route === "register" ? (
        registerId ? (
          <RegisterRuntimeScreen
            register={registerPort}
            registerId={registerId}
            registerName={authority.register?.name ?? registerId}
            locationLabel={authority.register?.locationId ?? "Assigned location"}
            deviceId={deviceId}
            currency={authority.register?.currency ?? "GHS"}
            onShiftChange={onShiftChange}
          />
        ) : (
          <section>
            <h1>Register</h1>
            <p className="muted">No register is assigned to this staff session.</p>
          </section>
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
