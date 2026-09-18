"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiResult, CustomerPort } from "../../../../docs/contracts/ports";
import type { CustomerSummary, StoreHealth } from "../../../../docs/contracts/domain.generated";
import { OrdersScreen } from "../features/orders";
import { CustomersScreen } from "../features/customers";
import { SettingsScreen } from "../features/settings";
import {
  FixAppPanel,
  NeedsAttentionScreen,
  StoreHealthScreen,
  type AttentionItemView,
  type OperationalLoadState,
} from "../ui/operational";
import { POS_LOCAL_SCHEMA_CURRENT } from "../local";
import type { CatalogProjectionAvailability, CatalogProjectionSyncResult } from "../local/catalog-sync";
import { ensureCatalogProjection } from "../local/catalog-sync";
import { resolveBrowserCatalogSourcePolicy } from "../core/catalog/source-policy";
import { readOrCreateLocalDeviceId, type StaffRuntimeAuthority } from "../core/identity";
import type { PosRoute } from "../ui/shell";
import { catalogRebuildStatusText, type CatalogRebuildView } from "./catalog-rebuild-status";

export function ApprovedWorkspaceScreens({
  route,
  authority,
  customers,
  online,
  catalogAvailability,
  fetchImpl,
  onNavigate,
  onCatalogProjectionChange,
}: {
  readonly route: PosRoute;
  readonly authority: StaffRuntimeAuthority;
  readonly customers: CustomerPort;
  readonly online: boolean;
  readonly catalogAvailability: CatalogProjectionAvailability | null;
  readonly fetchImpl?: typeof fetch;
  readonly onNavigate: (route: PosRoute) => void;
  readonly onCatalogProjectionChange?: (result: CatalogProjectionSyncResult) => void;
}) {
  if (route === "orders") {
    return (
      <OrdersScreen
        orders={[]}
        state="ready"
        onNewSale={() => onNavigate("sell")}
      />
    );
  }
  if (route === "customers") {
    return <CustomersWorkspace customers={customers} online={online} onUseCustomer={() => onNavigate("sell")} />;
  }
  if (route === "settings") {
    return (
      <SettingsScreen
        settings={{
          deviceName: readOrCreateLocalDeviceId(),
          registerName: authority.register?.name ?? "No register assigned",
          scannerLabel: "Attached scanner (presentation only)",
          printerLabel: "Receipt printer via PrintPort",
          appearance: "system",
          buildId: "local-dev",
          contractVersion: "1.0.0",
          localSchemaVersion: String(POS_LOCAL_SCHEMA_CURRENT),
        }}
        state={online ? "ready" : "offline"}
        onOpenStoreHealth={() => onNavigate("health")}
      />
    );
  }
  if (route === "health") {
    return (
      <HealthWorkspace
        authority={authority}
        catalogAvailability={catalogAvailability}
        fetchImpl={fetchImpl}
        onNavigate={onNavigate}
        onCatalogProjectionChange={onCatalogProjectionChange}
      />
    );
  }
  if (route === "attention") {
    return (
      <AttentionWorkspace
        catalogAvailability={catalogAvailability}
        authority={authority}
        fetchImpl={fetchImpl}
        onCatalogProjectionChange={onCatalogProjectionChange}
      />
    );
  }
  return null;
}

function CustomersWorkspace({
  customers,
  online,
  onUseCustomer,
}: {
  readonly customers: CustomerPort;
  readonly online: boolean;
  readonly onUseCustomer: (customer: CustomerSummary) => void;
}) {
  const [rows, setRows] = useState<readonly CustomerSummary[]>([]);
  const [state, setState] = useState<"ready" | "loading" | "error" | "offline">("loading");

  const load = useCallback(async () => {
    const result = await customers.search("");
    if (!result.ok) {
      setState("error");
      return;
    }
    setRows(result.data);
    setState(online ? "ready" : "offline");
  }, [customers, online]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <CustomersScreen
      customers={rows}
      state={state}
      onRetry={() => {
        void load();
      }}
      onUseCustomer={onUseCustomer}
    />
  );
}

function HealthWorkspace({
  authority,
  catalogAvailability,
  fetchImpl,
  onNavigate,
  onCatalogProjectionChange,
}: {
  readonly authority: StaffRuntimeAuthority;
  readonly catalogAvailability: CatalogProjectionAvailability | null;
  readonly fetchImpl?: typeof fetch;
  readonly onNavigate: (route: PosRoute) => void;
  readonly onCatalogProjectionChange?: (result: CatalogProjectionSyncResult) => void;
}) {
  const [health, setHealth] = useState<StoreHealth | undefined>();
  const [state, setState] = useState<OperationalLoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [showFix, setShowFix] = useState(false);
  const [rebuild, setRebuild] = useState<CatalogRebuildView>({ phase: "idle" });

  const load = useCallback(async () => {
    const result = await fetchStoreHealth(fetchImpl);
    if (!result.ok) {
      setHealth(undefined);
      setState("error");
      setErrorMessage(result.error.message);
      return;
    }
    setHealth(result.data);
    setState("ready");
    setErrorMessage(undefined);
  }, [fetchImpl]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const rebuildCatalog = useCallback(() => {
    void runCatalogRebuild({ fetchImpl, onCatalogProjectionChange, setRebuild });
  }, [fetchImpl, onCatalogProjectionChange]);

  const rebuildText = catalogRebuildStatusText(rebuild);

  return (
    <>
      <StoreHealthScreen
        health={health}
        state={state}
        errorMessage={errorMessage}
        deviceName={authority.register?.name ?? readOrCreateLocalDeviceId()}
        appVersion={health?.buildId}
        localSchemaVersion={String(POS_LOCAL_SCHEMA_CURRENT)}
        onRetry={() => {
          void load();
        }}
        onFixApp={() => setShowFix(true)}
        onOpenAttention={() => onNavigate("attention")}
        onRebuildCatalog={rebuildCatalog}
      />
      {rebuildText ? (
        <p
          className={rebuild.phase === "failure" ? "banner danger" : "muted"}
          role={rebuild.phase === "failure" ? "alert" : "status"}
          data-catalog-rebuild-phase={rebuild.phase}
        >
          {rebuildText}
        </p>
      ) : null}
      {showFix ? (
        <FixAppPanel
          criticalOperationActive={false}
          onCheckHealth={() => {
            void load();
          }}
          onRebuildCatalog={rebuildCatalog}
        />
      ) : null}
      {catalogAvailability === "unavailable" || catalogAvailability === "stale" ? (
        <p className="muted" role="status">
          Catalog projection is {catalogAvailability}. Search stays local; carts and journal are preserved.
        </p>
      ) : null}
    </>
  );
}

function AttentionWorkspace({
  catalogAvailability,
  authority,
  fetchImpl,
  onCatalogProjectionChange,
}: {
  readonly catalogAvailability: CatalogProjectionAvailability | null;
  readonly authority: StaffRuntimeAuthority;
  readonly fetchImpl?: typeof fetch;
  readonly onCatalogProjectionChange?: (result: CatalogProjectionSyncResult) => void;
}) {
  const [rebuild, setRebuild] = useState<CatalogRebuildView>({ phase: "idle" });
  const items = useMemo(() => {
    const next: AttentionItemView[] = [];
    if (catalogAvailability === "unavailable" || catalogAvailability === "stale") {
      next.push({
        id: "catalog-projection",
        title: catalogAvailability === "unavailable" ? "Catalog projection unavailable" : "Catalog projection is stale",
        summary:
          catalogAvailability === "unavailable"
            ? "Provider catalog has not populated this device. Local search cannot invent products. Carts and journal are preserved."
            : "The local catalog projection is older than the last successful provider sync. Search still uses local data.",
        typeLabel: "Catalog",
        severity: catalogAvailability === "unavailable" ? "critical" : "medium",
        retryAllowed: true,
      });
    }
    if (!authority.register) {
      next.push({
        id: "register-unassigned",
        title: "No register assigned",
        summary: "This staff session has no permitted register. Open/close shift stays blocked until assignment exists.",
        typeLabel: "Register",
        severity: "medium",
      });
    } else if (!authority.shiftOpen) {
      next.push({
        id: "shift-closed",
        title: "No open shift",
        summary: "Checkout stays blocked until an assigned register has an open shift. Use Register; do not invent a shift.",
        typeLabel: "Register",
        severity: "low",
      });
    }
    return next;
  }, [authority.register, authority.shiftOpen, catalogAvailability]);

  return (
    <>
    <NeedsAttentionScreen
      items={items}
      state="ready"
      onRetryItem={(id) => {
        if (id !== "catalog-projection") {
          return;
        }
        void runCatalogRebuild({ fetchImpl, onCatalogProjectionChange, setRebuild });
      }}
    />
    {catalogRebuildStatusText(rebuild) ? (
      <p
        className={rebuild.phase === "failure" ? "banner danger" : "muted"}
        role={rebuild.phase === "failure" ? "alert" : "status"}
        data-catalog-rebuild-phase={rebuild.phase}
      >
        {catalogRebuildStatusText(rebuild)}
      </p>
    ) : null}
    </>
  );
}

async function runCatalogRebuild(input: {
  readonly fetchImpl?: typeof fetch;
  readonly onCatalogProjectionChange?: (result: CatalogProjectionSyncResult) => void;
  readonly setRebuild: (view: CatalogRebuildView) => void;
}): Promise<void> {
  input.setRebuild({ phase: "rebuilding" });
  try {
    const result = await ensureCatalogProjection({
      policy: resolveBrowserCatalogSourcePolicy({
        hostname: typeof window === "undefined" ? "localhost" : window.location.hostname,
        nodeEnv: process.env.NODE_ENV,
      }),
      fetchImpl: input.fetchImpl,
      force: true,
    });
    if (result.producerUnavailable && result.availability === "unavailable") {
      input.setRebuild({
        phase: "failure",
        message: "catalog producer is unavailable",
      });
      input.onCatalogProjectionChange?.(result);
      return;
    }
    input.setRebuild({
      phase: "success",
      itemCount: result.itemCount,
      availability: result.availability,
    });
    input.onCatalogProjectionChange?.(result);
  } catch (error) {
    input.setRebuild({
      phase: "failure",
      message: error instanceof Error ? error.message : "catalog rebuild is unavailable",
    });
  }
}

async function fetchStoreHealth(fetchImpl?: typeof fetch): Promise<ApiResult<StoreHealth>> {
  const correlation = crypto.randomUUID();
  try {
    const response = await (fetchImpl ?? fetch)("/api/pos/v1/health", {
      method: "GET",
      credentials: "include",
      headers: {
        accept: "application/json",
        "x-correlation-id": correlation,
      },
    });
    return (await response.json()) as ApiResult<StoreHealth>;
  } catch {
    return {
      ok: false,
      error: {
        code: "INTEGRATION_UNAVAILABLE",
        message: "store health could not be reached",
        retryable: true,
        nextAction: "resolve",
      },
      correlationId: correlation,
    };
  }
}
