"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SellRuntimeScreen, type SellSessionPorts } from "../features/sell";
import { createBrowserPricingPort } from "../features/sell/runtime/pricingClient";
import {
  createBrowserCashCheckoutPorts,
  createBrowserPaymentPort,
  createBrowserRegisterPort,
  createBrowserReturnPort,
  createBrowserSalesResolvePort,
} from "./checkout-client";
import {
  createAttentionRecoveryLock,
  hasBlockingLocalTransactionRecovery,
  loadLocalJournalAttentionItems,
  mergeAttentionItems,
  runAttentionRecovery,
} from "./attention-recovery";
import { RegisterRuntimeScreen } from "./register-runtime";
import { ReturnsRuntimeScreen, createBrowserHistoricReturnSaleLookup } from "./returns-runtime";
import { StaffAuthGate } from "./staff-auth-gate";
import { ApprovedWorkspaceScreens, clientAttentionExtras } from "./workspace-runtime";
import { AppShell, POS_ROUTE_HREFS, type PosRoute } from "../ui/shell";
import { returnSelectionHref } from "./pos-route";
import { resolveBrowserCatalogSourcePolicy } from "../core/catalog/source-policy";
import {
  CASHIER_SEED_LOCATION_ID,
  CATALOG_REFRESH_MIN_INTERVAL_MS,
  createCartDraftStore,
  createLocalCatalogPort,
  createLocalCustomerPort,
  createOperationJournal,
  createTenderActivityPort,
  ensureCashierLocalSeed,
  ensureCatalogProjection,
  openPosLocalDatabase,
  recallActiveCartId,
  rememberActiveCartId,
  replaceActiveCartDraft,
} from "../local";
import type { CatalogProjectionAvailability, CatalogProjectionSyncResult } from "../local/catalog-sync";
import { catalogProjectionSyncApplied } from "../local/catalog-sync";
import {
  checkoutScopeFromStaffAuthority,
  createBffStaffSessionGateway,
  createPublicSupabaseStaffAuthProvider,
  createLocalOfflineStaffPresentationStore,
  createStaffIdentityPort,
  createStaffRuntimeController,
  readOrCreateLocalDeviceId,
  type StaffRuntimeAuthority,
  type StaffRuntimeController,
} from "../core/identity";
import type { AuthNoticeState } from "../features/auth";
import { isUuidLike, toCashierError } from "../ui/cashier-language";
import type { OperationJournal } from "../../../../docs/contracts/ports";
import type { Shift } from "../../../../docs/contracts/domain.generated";
import type { CustomerSummary } from "../../../../docs/contracts/domain.generated";
import type { CustomerSearchResultView } from "../features/sell";
import type { AppToastView } from "../ui/toast";
import type { AttentionItemView, OperationalLoadState } from "../ui/operational";
import { applyAppearance, readStoredAppearance, type AppearancePreference } from "../features/settings/appearance";
import { loadCustomerSearchPresentation } from "../features/customers/loadCustomerSearch";
import { customerViewFromSummary } from "../features/sell/runtime/mapCartDraft";
import { fetchAttentionInbox, fetchCustomerDirectory, fetchStoreHealth } from "./operational-client";
import { fetchManagementContext } from "./management-client";

function bumpCatalogProjectionGeneration(
  generationRef: { current: number },
  result: CatalogProjectionSyncResult | "applied",
): number {
  if (result === "applied" || catalogProjectionSyncApplied(result)) {
    generationRef.current += 1;
  }
  return generationRef.current;
}

export function hasFreshStaffActionAuthority(authority: StaffRuntimeAuthority): boolean {
  return authority.status === "ready" && Boolean(authority.session) && !authority.presentationOnly;
}

export function PosApp({
  route,
  fetchImpl,
  initialReturnSaleId,
}: {
  readonly route: PosRoute;
  readonly fetchImpl?: typeof fetch;
  readonly initialReturnSaleId?: string | null;
}) {
  const router = useRouter();
  return (
    <PosRuntime
      route={route}
      fetchImpl={fetchImpl}
      initialReturnSaleId={initialReturnSaleId}
      onNavigate={(next) => router.push(POS_ROUTE_HREFS[next])}
      onOpenManagement={() => router.push("/management")}
      onReturnSaleSelected={(saleId) => router.push(returnSelectionHref(saleId))}
    />
  );
}

export function PosRuntime({
  route,
  fetchImpl,
  onNavigate,
  onOpenManagement,
  initialReturnSaleId,
  onReturnSaleSelected,
}: {
  readonly route: PosRoute;
  readonly fetchImpl?: typeof fetch;
  readonly onNavigate: (route: PosRoute) => void;
  readonly onOpenManagement?: () => void;
  readonly initialReturnSaleId?: string | null;
  readonly onReturnSaleSelected?: (saleId: string) => void;
}) {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [ports, setPorts] = useState<SellSessionPorts | null>(null);
  const [projectionAvailability, setProjectionAvailability] = useState<CatalogProjectionAvailability | null>(null);
  const refreshInFlight = useRef(false);
  const catalogProjectionGenerationRef = useRef(0);
  const [authority, setAuthority] = useState<StaffRuntimeAuthority>(() => ({
    status: "restoring",
    session: null,
    assignedLocationIds: [],
    assignedRegisterIds: [],
    assignedRegisters: [],
    selectedRegisterId: null,
    register: null,
    shift: null,
    shiftOpen: false,
  }));
  const restoreCountRef = useRef(0);
  const catalogBootstrapCountRef = useRef(0);
  const ownerNodeRef = useRef<HTMLDivElement | null>(null);
  const [appearance, setAppearance] = useState<AppearancePreference>("system");
  const [toast, setToast] = useState<AppToastView | null>(null);
  const toastTimer = useRef<number | null>(null);
  const [buildId, setBuildId] = useState<string | undefined>();
  const [serverAttention, setServerAttention] = useState<readonly AttentionItemView[]>([]);
  const [localAttention, setLocalAttention] = useState<readonly AttentionItemView[]>([]);
  const [localRecoveryActorId, setLocalRecoveryActorId] = useState<string | null>(null);
  const [attentionState, setAttentionState] = useState<OperationalLoadState>("loading");
  const [nextSaleCustomer, setNextSaleCustomer] = useState<CustomerSearchResultView | null>(null);
  const [pendingReturnSaleId, setPendingReturnSaleId] = useState<string | null>(
    initialReturnSaleId ?? null,
  );
  const [managementActorId, setManagementActorId] = useState<string | null>(null);
  const readOnline = useCallback(() => online, [online]);

  const policy = useMemo(
    () =>
      resolveBrowserCatalogSourcePolicy({
        hostname: typeof window === "undefined" ? "localhost" : window.location.hostname,
        nodeEnv: process.env.NODE_ENV,
      }),
    [],
  );

  const recoveryJournal = useMemo<OperationJournal>(() => {
    const currentJournal = () => createOperationJournal(openPosLocalDatabase());
    return {
      appendBeforeSend: (...args) => currentJournal().appendBeforeSend(...args),
      pending: () => currentJournal().pending(),
      markSent: (...args) => currentJournal().markSent(...args),
      markResponseUnknown: (...args) => currentJournal().markResponseUnknown(...args),
      markAcknowledged: (...args) => currentJournal().markAcknowledged(...args),
      markRequiresAttention: (...args) => currentJournal().markRequiresAttention(...args),
    };
  }, []);
  const recoveryTenderActivity = useMemo(() => {
    const currentTenderActivity = () => createTenderActivityPort(openPosLocalDatabase());
    return {
      markActive: (transactionId: string) => currentTenderActivity().markActive(transactionId),
      clear: (transactionId: string) => currentTenderActivity().clear(transactionId),
    };
  }, []);
  const registerPort = useMemo(() => createBrowserRegisterPort({ fetchImpl }), [fetchImpl]);
  const paymentPort = useMemo(
    () =>
      createBrowserPaymentPort({
        fetchImpl,
        journal: recoveryJournal,
        tenderActivity: recoveryTenderActivity,
      }),
    [fetchImpl, recoveryJournal, recoveryTenderActivity],
  );
  const salesPort = useMemo(
    () =>
      createBrowserSalesResolvePort({
        fetchImpl,
        journal: recoveryJournal,
        tenderActivity: recoveryTenderActivity,
      }),
    [fetchImpl, recoveryJournal, recoveryTenderActivity],
  );
  const attentionRecoveryLock = useRef(createAttentionRecoveryLock());
  const [recoveringItemId, setRecoveringItemId] = useState<string | null>(null);
  const runtime = useMemo<StaffRuntimeController>(
    () =>
      createStaffRuntimeController({
        gateway: createBffStaffSessionGateway({ fetchImpl }),
        auth: createPublicSupabaseStaffAuthProvider({ fetchImpl }),
        registers: registerPort,
        offlinePresentationStore: createLocalOfflineStaffPresentationStore(),
        isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
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
    const timer = window.setTimeout(() => {
      const stored = readStoredAppearance();
      setAppearance(stored);
      applyAppearance(stored);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const showToast = useCallback((next: AppToastView) => {
    setToast(next);
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  const loadAttention = useCallback(async (mode: "full" | "refresh" = "full") => {
    if (mode === "full") {
      setAttentionState("loading");
    }
    const [result, localResult] = await Promise.all([
      fetchAttentionInbox(fetchImpl),
      loadLocalJournalAttentionItems(recoveryJournal)
        .then((items) => ({ ok: true as const, items }))
        .catch(() => ({ ok: false as const, items: [] as readonly AttentionItemView[] })),
    ]);

    if (localResult.ok) {
      setLocalAttention(localResult.items);
      setLocalRecoveryActorId(authority.session?.actorId ?? null);
    } else {
      setLocalAttention([]);
      setLocalRecoveryActorId(null);
    }

    if (!result.ok) {
      setServerAttention([]);
      setAttentionState(localResult.ok ? "degraded" : "error");
      return;
    }
    setServerAttention(result.data.items);
    setAttentionState(localResult.ok ? "ready" : "degraded");
  }, [authority.session?.actorId, fetchImpl, recoveryJournal]);

  useEffect(() => {
    if (authority.status !== "ready" || !authority.session) {
      return;
    }
    const timer = window.setTimeout(() => {
      void loadAttention();
      void fetchStoreHealth(fetchImpl).then((result) => {
        if (result.ok) {
          setBuildId(result.data.buildId);
        }
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authority.session, authority.status, fetchImpl, loadAttention]);

  useEffect(() => {
    if (authority.status !== "ready" || !authority.session || authority.presentationOnly) {
      return;
    }
    const actorId = authority.session.actorId;
    let cancelled = false;
    void fetchManagementContext(fetchImpl ?? fetch).then((result) => {
      if (!cancelled) {
        setManagementActorId(result.ok ? actorId : null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [authority.presentationOnly, authority.session, authority.status, fetchImpl]);

  useEffect(() => {
    function sync() {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        void runtime.refreshRegister();
        void loadAttention("refresh");
      }
    }
    function onVisible() {
      if (document.visibilityState === "visible") {
        void runtime.refreshRegister();
        void loadAttention("refresh");
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
  }, [loadAttention, runtime]);

  const mountPorts = useCallback(
    async (
      availability: CatalogProjectionAvailability,
      current: StaffRuntimeAuthority,
      catalogProjectionGeneration: number,
    ) => {
      const db = openPosLocalDatabase();
      const customers = createLocalCustomerPort({ db });
      const locationId = current.register?.locationId ?? current.assignedLocationIds[0] ?? CASHIER_SEED_LOCATION_ID;
      const deviceId = current.shift?.deviceId ?? readOrCreateLocalDeviceId();
      const scope = checkoutScopeFromStaffAuthority(current, deviceId);
      const checkout =
        scope && !current.presentationOnly
          ? createBrowserCashCheckoutPorts({
              fetchImpl,
              scope,
              journal: createOperationJournal(db),
              tenderActivity: createTenderActivityPort(db),
            })
          : null;
      setProjectionAvailability(availability);
      setPorts({
        catalog: createLocalCatalogPort({ db }),
        customers,
        customerSearch: async (query) => {
          const result = await loadCustomerSearchPresentation({
            query,
            remoteSearch: (needle) => fetchCustomerDirectory(needle, fetchImpl),
            localSearch: (needle) => customers.search(needle),
          });
          return result.ok ? result.customers.map(customerViewFromSummary) : [];
        },
        drafts: createCartDraftStore(db),
        rememberCartId: (cartId) => rememberActiveCartId(cartId, db),
        recallCartId: () => recallActiveCartId(db),
        replaceActiveCart: (previousCartId, next) => replaceActiveCartDraft(previousCartId, next, db),
        locationId,
        pricing: current.presentationOnly ? undefined : createBrowserPricingPort({ fetchImpl }),
        shiftOpen: current.presentationOnly ? false : current.shiftOpen,
        checkout: checkout?.checkout,
        payments: checkout?.payments,
        sales: checkout?.sales,
        receipts: checkout?.receipts,
        printer: checkout?.printer,
        checkoutScope: checkout?.scope,
        catalogAvailability: availability,
        catalogProjectionGeneration,
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
      if (snapshot.presentationOnly) {
        await mountPorts("stale", snapshot, catalogProjectionGenerationRef.current);
        return;
      }
      try {
        const synced = await ensureCatalogProjection({
          policy,
          fetchImpl,
          force: true,
        });
        if (cancelled) {
          return;
        }
        const generation = bumpCatalogProjectionGeneration(catalogProjectionGenerationRef, synced);
        await mountPorts(synced.availability, snapshot, generation);
      } catch {
        if (cancelled) {
          return;
        }
        if (policy === "synthetic_permitted") {
          await ensureCashierLocalSeed();
          const generation = bumpCatalogProjectionGeneration(catalogProjectionGenerationRef, "applied");
          await mountPorts("fresh", snapshot, generation);
          return;
        }
        await mountPorts("unavailable", snapshot, catalogProjectionGenerationRef.current);
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
    if (authority.status !== "ready" || !authority.session || authority.presentationOnly) {
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
        const generation = bumpCatalogProjectionGeneration(catalogProjectionGenerationRef, synced);
        setProjectionAvailability(synced.availability);
        setPorts((current) =>
          current
            ? {
                ...current,
                catalogAvailability: synced.availability,
                catalogProjectionGeneration: generation,
              }
            : current,
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
  }, [authority.presentationOnly, authority.session, authority.status, fetchImpl, policy]);

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
    const generation = bumpCatalogProjectionGeneration(catalogProjectionGenerationRef, result);
    setProjectionAvailability(result.availability);
    setPorts((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        catalog: createLocalCatalogPort({ db: openPosLocalDatabase() }),
        catalogAvailability: result.availability,
        catalogProjectionGeneration: generation,
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

  const authoritativeActionsAllowed = hasFreshStaffActionAuthority(authority);
  const managementAvailable =
    authoritativeActionsAllowed &&
    managementActorId === authority.session.actorId;
  const deviceId = authority.shift?.deviceId ?? readOrCreateLocalDeviceId();
  const extras = clientAttentionExtras({ catalogAvailability: projectionAvailability, authority });
  const localRecoveryChecked = localRecoveryActorId === authority.session.actorId;
  const effectiveLocalAttention = localRecoveryChecked ? localAttention : [];
  const attentionItems = mergeAttentionItems(serverAttention, effectiveLocalAttention, extras);
  const localTransactionRecoveryBlocked =
    !localRecoveryChecked || hasBlockingLocalTransactionRecovery(effectiveLocalAttention);
  const attentionCount = attentionItems.length;
  const sellPorts =
    ports && localTransactionRecoveryBlocked
      ? { ...ports, checkout: undefined, payments: undefined, sales: undefined }
      : ports;

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
      shiftOpen={authority.presentationOnly ? false : authority.shiftOpen}
      online={online}
      liveMessage={cashierAuthorityError}
      attentionCount={attentionCount}
      toast={toast}
      onNavigate={onNavigate}
      onOpenManagement={managementAvailable ? onOpenManagement : undefined}
      onLock={() => {
        void (async () => {
          await identity.signOut();
          await runtime.signOut();
        })();
      }}
    >
      {authority.presentationOnly ? (
        <div className="banner warning" role="status" data-offline-presentation-only="true">
          <strong>{online ? "Connection unavailable." : "Offline mode."}</strong>
          <span>
            Showing the last verified cashier, register, saved products and cart. Payments, authoritative pricing,
            returns and register changes stay unavailable until {online ? "the service recovers." : "reconnect."}
          </span>
        </div>
      ) : cashierAuthorityError ? (
        <p className="banner danger" role="status" data-register-authority-degraded="">
          {cashierAuthorityError} Last known register and shift stay visible until we get an updated result.
        </p>
      ) : null}
      {route === "sell" ? (
        sellPorts ? (
          <>
            {projectionAvailability === "unavailable" ? (
              <p className="muted" role="status">
                {"Products couldn't be loaded. Check the connection and try again."}
              </p>
            ) : null}
            {localTransactionRecoveryBlocked ? (
              <div className="banner warning" role="alert" data-local-recovery-blocked="true">
                <strong>
                  {localRecoveryChecked ? "Previous transaction needs a status check." : "Checking saved transaction work…"}
                </strong>
                <span>
                  {localRecoveryChecked
                    ? "Open Needs attention and check the existing transaction before taking another payment."
                    : "Checkout will stay unavailable until saved transaction work has been checked."}
                </span>
                {localRecoveryChecked ? (
                  <button className="btn small" type="button" onClick={() => onNavigate("attention")}>
                    View issues
                  </button>
                ) : null}
              </div>
            ) : null}
            <SellRuntimeScreen
              {...sellPorts}
              shiftOpen={authoritativeActionsAllowed ? authority.shiftOpen : false}
              online={readOnline}
              catalogAvailability={sellPorts.catalogAvailability}
              nextSaleCustomer={nextSaleCustomer}
              onNextSaleCustomerApplied={() => setNextSaleCustomer(null)}
            />
          </>
        ) : (
          <p className="muted">Loading products…</p>
        )
      ) : route === "returns" ? (
        authoritativeActionsAllowed ? (
          <ReturnsRuntimeScreen
            returns={returns}
            lookup={lookup}
            initialSaleId={initialReturnSaleId ?? pendingReturnSaleId}
            onSaleSelected={(saleId) => {
              setPendingReturnSaleId(saleId);
              onReturnSaleSelected?.(saleId);
            }}
          />
        ) : (
          <section className="card card-pad" data-presentation-only-returns="true">
            <h1>Returns</h1>
            <p className="banner warning">
              Reconnect and restore the staff session before reviewing or completing a return.
            </p>
          </section>
        )
      ) : route === "register" ? (
        !authoritativeActionsAllowed ? (
          <section className="card card-pad">
            <h1>Register</h1>
            <p className="banner warning">Reconnect before opening, closing, or changing a register.</p>
          </section>
        ) : authority.assignedRegisterIds.length > 0 ? (
          <RegisterRuntimeScreen
            register={registerPort}
            registerId={authority.selectedRegisterId}
            registerChoices={authority.assignedRegisterIds.map((id) => {
              const record = authority.assignedRegisters.find((item) => item.id === id);
              return {
                id,
                name: record?.name ?? id,
                locationLabel: record && !isUuidLike(record.locationId) ? record.locationId : undefined,
              };
            })}
            registerName={authority.register?.name ?? authority.selectedRegisterId ?? "Register"}
            locationLabel={isUuidLike(authority.register?.locationId) ? undefined : authority.register?.locationId}
            deviceId={deviceId}
            currency={authority.register?.currency ?? "GHS"}
            onSelectRegister={(id) => {
              void runtime.selectRegister(id);
            }}
            onShiftChange={onShiftChange}
            onOpened={() => {
              showToast({ title: "Register opened." });
              onNavigate("sell");
            }}
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
          appearance={appearance}
          buildId={buildId}
          attentionItems={attentionItems}
          attentionCount={attentionCount}
          attentionState={attentionState}
          onNavigate={onNavigate}
          onCatalogProjectionChange={onCatalogProjectionChange}
          onUseCustomer={(customer: CustomerSummary) => {
            setNextSaleCustomer(customerViewFromSummary(customer));
            showToast({ title: "Customer selected for next sale." });
            onNavigate("sell");
          }}
          onAppearanceChange={(next) => {
            setAppearance(next);
            applyAppearance(next);
          }}
          onRebuildSuccess={() => {
            showToast({
              title: "Rebuildable catalog projection refreshed.",
              detail: "Durable cart was preserved.",
            });
          }}
          onRetryAttention={() => {
            void loadAttention();
          }}
          selectedCustomerId={nextSaleCustomer?.id}
          receipts={ports?.receipts}
          printer={ports?.printer}
          onStartReturn={
            authoritativeActionsAllowed
              ? (saleId) => {
                  setPendingReturnSaleId(saleId);
                  if (onReturnSaleSelected) {
                    onReturnSaleSelected(saleId);
                  } else {
                    onNavigate("returns");
                  }
                }
              : undefined
          }
          recoveringItemId={recoveringItemId}
          onResolveAttention={
            authoritativeActionsAllowed
              ? (item: AttentionItemView) => {
                  if (item.recoverKind === "register" || item.recoverKind === "shift") {
                    onNavigate("register");
                    return;
                  }
                  if (item.recoverKind === "catalog") {
                    onNavigate("health");
                    return;
                  }
                  void runAttentionRecovery({
                    item,
                    lock: attentionRecoveryLock.current,
                    ports: { payments: paymentPort, sales: salesPort },
                    reload: () => loadAttention("refresh"),
                    onStart: (id) => setRecoveringItemId(id),
                    onFinish: (id) => setRecoveringItemId((current) => (current === id ? null : current)),
                  });
                }
              : undefined
          }
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
