"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { ApprovedWorkspaceScreens } from "./workspace-runtime";
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
import type { CatalogProjectionAvailability, CatalogProjectionSyncResult } from "../local/catalog-sync";
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
import { toCashierError } from "../ui/cashier-language";
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
  const [projectionAvailability, setProjectionAvailability] = useState<CatalogProjectionAvailability | null>(null);
  const refreshInFlight = useRef(false);
  const [authority, setAuthority] = useState<StaffRuntimeAuthority>(() => ({
    status: "restoring",
    session: null,
    assignedLocationIds: [],
    assignedRegisterIds: [],
    register: null,
    shift: null,
    shiftOpen: false,
  }));
  const restoreCountRef = useRef(0);
  const catalogBootstrapCountRef = useRef(0);
  const ownerNodeRef = useRef<HTMLDivElement | null>(null);
  const readOnline = useCallback(() => online, [online]);
  const policy = useMemo(
    () =>
      resolveBrowserCatalogSourcePolicy({
        hostname: typeof window === "undefined" ? "localhost" : window.location.hostname,
        nodeEnv: process.env.NODE_ENV,
      }),
    [],
  );

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
    restoreCountRef.current += 1;
    writeOwnerCounts(ownerNodeRef.current, restoreCountRef.current, catalogBootstrapCountRef.current);
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

  const mountPorts = useCallback(
    async (availability: CatalogProjectionAvailability, current: StaffRuntimeAuthority) => {
      const db = openPosLocalDatabase();
      const locationId = current.register?.locationId ?? current.assignedLocationIds[0] ?? CASHIER_SEED_LOCATION_ID;
      const registerId = current.register?.id;
      const shiftId = current.shiftOpen ? current.shift?.id : undefined;
      const deviceId = current.shift?.deviceId ?? readOrCreateLocalDeviceId();
      const checkout = createBrowserCashCheckoutPorts({
        fetchImpl,
        ...(registerId && shiftId ? { scope: { registerId, shiftId, deviceId } } : {}),
      });
      setProjectionAvailability(availability);
      setPorts({
        catalog: createLocalCatalogPort({ db }),
        customers: createLocalCustomerPort({ db }),
        drafts: createCartDraftStore(db),
        rememberCartId: (cartId) => rememberActiveCartId(cartId, db),
        recallCartId: () => recallActiveCartId(db),
        locationId,
        pricing: createBrowserPricingPort({ fetchImpl }),
        shiftOpen: current.shiftOpen,
        checkout: checkout.checkout,
        payments: checkout.payments,
        sales: checkout.sales,
        receipts: checkout.receipts,
        printer: checkout.printer,
        checkoutScope: registerId && shiftId ? checkout.scope : undefined,
        catalogAvailability: availability,
      });
    },
    [fetchImpl],
  );

  useEffect(() => {
    if (authority.status !== "ready" || !authority.session) {
      return;
    }
    let cancelled = false;
    const snapshot = authority;
    catalogBootstrapCountRef.current += 1;
    writeOwnerCounts(ownerNodeRef.current, restoreCountRef.current, catalogBootstrapCountRef.current);
    void (async () => {
      try {
        const synced = await ensureCatalogProjection({
          policy,
          fetchImpl,
          force: true,
        });
        if (cancelled) {
          return;
        }
        await mountPorts(synced.availability, snapshot);
      } catch {
        if (cancelled) {
          return;
        }
        if (policy === "synthetic_permitted") {
          await ensureCashierLocalSeed();
          await mountPorts("fresh", snapshot);
          return;
        }
        await mountPorts("unavailable", snapshot);
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- listed authority fields are the catalog snapshot
  }, [
    authority.status,
    authority.session,
    authority.register,
    authority.shift,
    authority.shiftOpen,
    authority.assignedLocationIds,
    fetchImpl,
    mountPorts,
    policy,
  ]);

  useEffect(() => {
    if (authority.status !== "ready" || !authority.session) {
      return;
    }
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
  }, [authority.session, authority.status, fetchImpl, policy]);

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

  const onCatalogProjectionChange = useCallback((result: CatalogProjectionSyncResult) => {
    setProjectionAvailability(result.availability);
    setPorts((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        catalog: createLocalCatalogPort({ db: openPosLocalDatabase() }),
        catalogAvailability: result.availability,
      };
    });
  }, []);

  const onShiftChange = useCallback(
    (shift: Shift | null) => {
      runtime.applyShift(shift);
    },
    [runtime],
  );

  const cashierAuthorityError = authority.errorMessage
    ? toCashierError({
        message: authority.errorMessage,
        domain: authority.status === "ready" ? "register" : "auth",
      }).message
    : undefined;

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
      <PosRuntimeOwner
        ownerRef={ownerNodeRef}
        restoreCountRef={restoreCountRef}
        catalogBootstrapCountRef={catalogBootstrapCountRef}
        status={authority.status}
      >
        <StaffAuthGate
          noticeState={authNotice}
          busy={authority.status === "restoring"}
          errorMessage={authority.errorMessage}
          onSignIn={(request) => {
            void runtime.signIn(request);
          }}
        />
      </PosRuntimeOwner>
    );
  }

  const registerId = authority.register?.id;
  const deviceId = authority.shift?.deviceId ?? readOrCreateLocalDeviceId();

  return (
    <PosRuntimeOwner
      ownerRef={ownerNodeRef}
      restoreCountRef={restoreCountRef}
      catalogBootstrapCountRef={catalogBootstrapCountRef}
      status={authority.status}
    >
    <AppShell
      activeRoute={route}
      registerName={authority.register?.name ?? "No register"}
      cashierDisplayName={authority.session.displayName}
      shiftOpen={authority.shiftOpen}
      online={online}
      liveMessage={cashierAuthorityError}
      onNavigate={onNavigate}
      onLock={() => {
        void (async () => {
          await identity.signOut();
          await runtime.signOut();
        })();
      }}
    >
      {cashierAuthorityError ? (
        <p className="banner danger" role="status" data-register-authority-degraded="">
          {cashierAuthorityError} Last known register and shift stay visible until we get an updated result.
        </p>
      ) : null}
      {route === "sell" ? (
        ports ? (
          <>
            {projectionAvailability === "unavailable" ? (
              <p className="muted" role="status">
                {"Products couldn't be loaded. Check the connection and try again."}
              </p>
            ) : null}
            <SellRuntimeScreen {...ports} shiftOpen={authority.shiftOpen} online={readOnline} catalogAvailability={ports.catalogAvailability} />
          </>
        ) : (
          <p className="muted">Loading products…</p>
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
        <ApprovedWorkspaceScreens
          route={route}
          authority={authority}
          customers={ports?.customers ?? createLocalCustomerPort()}
          online={online}
          catalogAvailability={projectionAvailability}
          fetchImpl={fetchImpl}
          onNavigate={onNavigate}
          onCatalogProjectionChange={onCatalogProjectionChange}
        />
      )}
    </AppShell>
    </PosRuntimeOwner>
  );
}

function writeOwnerCounts(
  node: HTMLDivElement | null,
  restoreCount: number,
  catalogBootstrapCount: number,
): void {
  if (!node) {
    return;
  }
  node.dataset.staffRestoreCount = String(restoreCount);
  node.dataset.catalogBootstrapCount = String(catalogBootstrapCount);
}

function PosRuntimeOwner({
  ownerRef,
  restoreCountRef,
  catalogBootstrapCountRef,
  status,
  children,
}: {
  readonly ownerRef: { current: HTMLDivElement | null };
  readonly restoreCountRef: { current: number };
  readonly catalogBootstrapCountRef: { current: number };
  readonly status: StaffRuntimeAuthority["status"];
  readonly children: ReactNode;
}) {
  return (
    <div
      ref={(node) => {
        ownerRef.current = node;
        writeOwnerCounts(node, restoreCountRef.current, catalogBootstrapCountRef.current);
      }}
      data-pos-runtime-owner="true"
      data-staff-runtime-status={status}
    >
      {children}
    </div>
  );
}
