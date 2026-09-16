import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { ApiFailure, StoreHealth } from "../../docs/contracts/domain.generated";
import type { ApiResult } from "../../docs/contracts/ports";
import { createStoreHealthController, type StoreHealthPorts } from "../../apps/pos-web/src/features/health/storeHealthController";
import { StoreHealthScreen } from "../../apps/pos-web/src/features/health/StoreHealthScreen";
import {
  containsForbiddenRecoveryCopy,
  DURABLE_STATE_COPY,
  HEALTH_FETCH_FAILED_COPY,
  UNKNOWN_OPERATION_COPY,
  type RecoveryDiagnosticsView,
  type StoreHealthLifecycleSnapshot,
  type StoreHealthSessionView,
  type UpdateActivationDecisionView,
  type UpdateBlockReasonView,
} from "../../apps/pos-web/src/features/health/storeHealthView";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHECKED = "2026-09-16T10:00:00.000Z";

function success<T>(data: T): ApiResult<T> {
  return { ok: true, data, correlationId: CORRELATION };
}

function failure(message: string): ApiFailure {
  return {
    ok: false,
    correlationId: CORRELATION,
    error: { code: "INTEGRATION_UNAVAILABLE", message, retryable: true, nextAction: "retry_same_key" },
  };
}

function check(
  id: string,
  status: StoreHealth["checks"][number]["status"],
  message: string,
): StoreHealth["checks"][number] {
  return { id, status, message, checkedAt: CHECKED };
}

function storeHealth(overrides: Partial<StoreHealth> = {}): StoreHealth {
  return {
    checks: [check("commerce", "healthy", "Commerce is available.")],
    contractVersion: "1.0.0",
    pendingOperationCount: 0,
    attentionCount: 0,
    buildId: "1.2.0",
    ...overrides,
  };
}

function recovery(overrides: Partial<RecoveryDiagnosticsView> = {}): RecoveryDiagnosticsView {
  return {
    localSchema: 4,
    expectedSchema: 4,
    schemaCompatible: true,
    cartDraftCount: 2,
    pendingOperationCount: 0,
    attentionOperationCount: 0,
    rebuildableCatalogItemCount: 12,
    destructiveResetAllowed: false,
    recommendedActions: ["NONE"],
    ...overrides,
  };
}

function lifecycle(overrides: Partial<StoreHealthLifecycleSnapshot> = {}): StoreHealthLifecycleSnapshot {
  return {
    connectivity: "online",
    leadership: "active",
    updateReady: false,
    releasePolicy: {
      latestBuild: "1.3.0",
      recommendedBuild: "1.2.0",
      minimumSupportedBuild: "1.0.0",
      minimumApiVersion: "1.0.0",
      minimumLocalSchema: 4,
    },
    ...overrides,
  };
}

function createPorts(options?: {
  health?: StoreHealth | ApiFailure | Error;
  recovery?: RecoveryDiagnosticsView;
  lifecycle?: StoreHealthLifecycleSnapshot;
  activation?: UpdateActivationDecisionView;
}) {
  const healthResult = options?.health ?? storeHealth();
  const getStoreHealth = vi.fn(async () => {
    if (healthResult instanceof Error) {
      throw healthResult;
    }
    if ("ok" in healthResult && healthResult.ok === false) {
      return healthResult;
    }
    return success(healthResult as StoreHealth);
  });
  const getRecoveryDiagnostics = vi.fn(async () => options?.recovery ?? recovery());
  const getLifecycleSnapshot = vi.fn(() => options?.lifecycle ?? lifecycle());
  const activationDecision = vi.fn(async () => options?.activation ?? ({ safe: true } as const));
  const activateWaitingUpdate = vi.fn(async () => options?.activation ?? ({ safe: true } as const));
  const checkForUpdate = vi.fn(async () => undefined);
  const ports: StoreHealthPorts = {
    health: { getStoreHealth },
    getRecoveryDiagnostics,
    getLifecycleSnapshot,
    activationDecision,
    activateWaitingUpdate,
    checkForUpdate,
  };
  return {
    ports,
    getStoreHealth,
    getRecoveryDiagnostics,
    getLifecycleSnapshot,
    activationDecision,
    activateWaitingUpdate,
    checkForUpdate,
  };
}

async function readyController(options?: Parameters<typeof createPorts>[0]) {
  const created = createPorts(options);
  const controller = createStoreHealthController(created.ports);
  await controller.refresh();
  return { controller, ...created };
}

function renderScreen(session: StoreHealthSessionView, inFlight = false) {
  return renderToStaticMarkup(
    createElement(StoreHealthScreen, {
      session,
      inFlight,
      onRefresh: () => undefined,
      onCheckForUpdate: () => undefined,
      onActivateWaitingUpdate: () => undefined,
    }),
  );
}

function healthCss(): string {
  return readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../apps/pos-web/src/features/health/health.css"),
    "utf8",
  );
}

describe("FE-07 store health", () => {
  test("1 healthy checks render healthy without hiding other metadata", async () => {
    const { controller } = await readyController({
      health: storeHealth({
        pendingOperationCount: 0,
        attentionCount: 0,
        buildId: "1.2.0",
        checks: [check("commerce", "healthy", "Commerce is available.")],
      }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-health-check-status="healthy"');
    expect(html).toContain("Healthy");
    expect(html).toContain('data-contract-version="1.0.0"');
    expect(html).toContain('data-build-id="1.2.0"');
    expect(html).toContain('data-pending-count="0"');
    expect(html).toContain("Commerce is available.");
  });

  test("2 degraded check remains visibly degraded", async () => {
    const { controller } = await readyController({
      health: storeHealth({ checks: [check("pricing", "degraded", "Pricing is slow.")] }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-health-check-status="degraded"');
    expect(html).toContain("Degraded");
    expect(html).toContain("health-check-degraded");
    expect(html).not.toMatch(/data-health-check-id="pricing"[^>]*data-health-check-status="healthy"/);
  });

  test("3 unavailable check remains visibly unavailable", async () => {
    const { controller } = await readyController({
      health: storeHealth({ checks: [check("payments", "unavailable", "Payments cannot be reached.")] }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-health-check-status="unavailable"');
    expect(html).toContain("Unavailable");
    expect(html).toContain("health-check-unavailable");
  });

  test("4 unverified check is not rendered as verified or healthy", async () => {
    const { controller } = await readyController({
      health: storeHealth({ checks: [check("catalog", "unverified", "Catalog freshness is unverified.")] }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-health-check-status="unverified"');
    expect(html).toContain("Unverified — not confirmed");
    expect(html).toContain("health-check-unverified");
    expect(html).not.toContain("Verified");
    const row = html.match(/data-health-check-id="catalog"[\s\S]*?<\/li>/)?.[0] ?? "";
    expect(row).not.toContain(">Healthy<");
  });

  test("5 pending operation count is displayed", async () => {
    const { controller } = await readyController({
      health: storeHealth({ pendingOperationCount: 3 }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-pending-count="3"');
    expect(html).toContain("3 pending operations");
  });

  test("6 attention count produces attention UX", async () => {
    const { controller } = await readyController({
      health: storeHealth({ attentionCount: 2 }),
    });
    expect(controller.getSession().overallSeverity).toBe("requires_attention");
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-attention-count="2"');
    expect(html).toContain('data-attention-ux=""');
    expect(html).toContain("require attention");
  });

  test("7 health fetch failure is distinct from a healthy result", async () => {
    const { controller } = await readyController({
      health: failure("Health probe unavailable"),
    });
    expect(controller.getSession().stage).toBe("failed");
    expect(controller.getSession().health).toBeUndefined();
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-health-fetch-failed=""');
    expect(html).toContain(HEALTH_FETCH_FAILED_COPY);
    expect(html).not.toContain('data-health-check-status="healthy"');
  });

  test("8 update-ready safe state exposes update action", async () => {
    const { controller } = await readyController({
      lifecycle: lifecycle({ updateReady: true }),
      activation: { safe: true },
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-update-ready="true"');
    expect(html).toContain('data-update-safe="true"');
    expect(html).toContain("Activate waiting update");
  });

  test("9 clicking update delegates to injected CORE-07 lifecycle capability", async () => {
    const { controller, activateWaitingUpdate } = await readyController({
      lifecycle: lifecycle({ updateReady: true }),
      activation: { safe: true },
    });
    await controller.activateWaitingUpdate();
    expect(activateWaitingUpdate).toHaveBeenCalledTimes(1);
  });

  test("10 FE does not independently override an unsafe decision", async () => {
    const { controller, activateWaitingUpdate } = await readyController({
      lifecycle: lifecycle({ updateReady: true }),
      activation: { safe: false, reasons: ["ACTIVE_TENDER"] },
    });
    await controller.activateWaitingUpdate();
    expect(activateWaitingUpdate).not.toHaveBeenCalled();
    expect(controller.getSession().activation).toEqual({ safe: false, reasons: ["ACTIVE_TENDER"] });
  });

  test("11 repeated update click cannot trigger concurrent activation calls", async () => {
    let release!: (value: UpdateActivationDecisionView) => void;
    const created = createPorts({
      lifecycle: lifecycle({ updateReady: true }),
      activation: { safe: true },
    });
    created.activateWaitingUpdate.mockImplementation(
      () =>
        new Promise<UpdateActivationDecisionView>((resolve) => {
          release = resolve;
        }),
    );
    const controller = createStoreHealthController(created.ports);
    await controller.refresh();
    const first = controller.activateWaitingUpdate();
    const second = controller.activateWaitingUpdate();
    await vi.waitFor(() => {
      expect(typeof release).toBe("function");
    });
    release({ safe: true });
    await first;
    await second;
    expect(created.activateWaitingUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("FE-07 tender and critical operation safety", () => {
  async function blocked(reason: UpdateBlockReasonView) {
    return readyController({
      lifecycle: lifecycle({ updateReady: true }),
      activation: { safe: false, reasons: [reason] },
    });
  }

  test("12 ACTIVE_TENDER blocks update", async () => {
    const { controller, activateWaitingUpdate } = await blocked("ACTIVE_TENDER");
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-update-block-reason="ACTIVE_TENDER"');
    expect(html).toContain("An active payment or tender is in progress");
    expect(html).not.toContain("Activate waiting update");
    await controller.activateWaitingUpdate();
    expect(activateWaitingUpdate).not.toHaveBeenCalled();
  });

  test("13 active-tender state has no force-update path", async () => {
    const { controller } = await blocked("ACTIVE_TENDER");
    const html = renderScreen(controller.getSession());
    expect(html).toContain("There is no force-update action");
    expect(html.toLowerCase()).not.toContain("force update");
    expect(html.toLowerCase()).not.toContain("update anyway");
  });

  test("14 unknown payment/operation outcome is not presented as failure", async () => {
    const { controller } = await readyController({
      lifecycle: lifecycle({ unknownOperationPresent: true }),
      recovery: recovery({ attentionOperationCount: 1, recommendedActions: ["REVIEW_ATTENTION_OPERATIONS"] }),
    });
    const html = renderScreen(controller.getSession());
    const unknown = html.match(/data-unknown-operation=""[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(unknown).toContain(UNKNOWN_OPERATION_COPY);
    expect(unknown.toLowerCase()).not.toContain("failed");
  });

  test("15 unknown operation is not told to retry a sale or charge", async () => {
    const { controller } = await readyController({
      lifecycle: lifecycle({ unknownOperationPresent: true }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain("Do not retry the sale");
    expect(html.toLowerCase()).not.toContain("try the sale again");
    expect(html.toLowerCase()).not.toContain("charge again");
  });

  test("16 CRITICAL_OPERATION_PENDING blocks update", async () => {
    const { controller } = await blocked("CRITICAL_OPERATION_PENDING");
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-update-block-reason="CRITICAL_OPERATION_PENDING"');
    expect(html).toContain("still needs a final result");
    expect(html).not.toContain("Activate waiting update");
  });

  test("17 SYNC_MUTATION_IN_PROGRESS blocks update", async () => {
    const { controller } = await blocked("SYNC_MUTATION_IN_PROGRESS");
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-update-block-reason="SYNC_MUTATION_IN_PROGRESS"');
    expect(html).toContain("Synchronization or change persistence is underway");
  });

  test("18 LOCAL_MIGRATION_IN_PROGRESS blocks update", async () => {
    const { controller } = await blocked("LOCAL_MIGRATION_IN_PROGRESS");
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-update-block-reason="LOCAL_MIGRATION_IN_PROGRESS"');
    expect(html).toContain("Do not wipe storage");
  });

  test("19 UNSUPPORTED_APP_VERSION produces explicit blocking guidance", async () => {
    const { controller } = await blocked("UNSUPPORTED_APP_VERSION");
    expect(controller.getSession().overallSeverity).toBe("blocking");
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-update-block-reason="UNSUPPORTED_APP_VERSION"');
    expect(html).toContain("no longer supported");
    expect(html).toContain("Business data will not be deleted");
  });
});

describe("FE-07 multi-tab, recovery, offline, and accessibility", () => {
  test("20 PASSIVE_WINDOW shows another-tab/passive guidance", async () => {
    const { controller } = await readyController({
      lifecycle: lifecycle({ leadership: "passive", updateReady: true }),
      activation: { safe: false, reasons: ["PASSIVE_WINDOW"] },
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-passive-tab=""');
    expect(html).toContain("This tab is passive");
    expect(html).toContain('data-leadership="passive"');
  });

  test("21 passive tab cannot activate a waiting update", async () => {
    const { controller, activateWaitingUpdate, checkForUpdate } = await readyController({
      lifecycle: lifecycle({ leadership: "passive", updateReady: true }),
      activation: { safe: false, reasons: ["PASSIVE_WINDOW"] },
    });
    await controller.activateWaitingUpdate();
    await controller.checkForUpdate();
    expect(activateWaitingUpdate).not.toHaveBeenCalled();
    expect(checkForUpdate).not.toHaveBeenCalled();
    const html = renderScreen(controller.getSession());
    expect(html).not.toContain("Activate waiting update");
  });

  test("22 UI does not invent active-tab identity", async () => {
    const { controller } = await readyController({
      lifecycle: lifecycle({ leadership: "unknown" }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain("lifecycle role is unknown");
    expect(html).not.toContain("ownerId");
    expect(html).not.toContain("tab-");
    expect(html).not.toContain("leader-");
  });

  test("23 incompatible schema shows migration/recovery-needed state", async () => {
    const { controller } = await readyController({
      recovery: recovery({
        localSchema: 3,
        expectedSchema: 4,
        schemaCompatible: false,
        recommendedActions: ["MIGRATE_LOCAL_SCHEMA"],
      }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-schema-incompatible=""');
    expect(html).toContain("Local schema is incompatible");
    expect(html).not.toContain("Migrate now");
    expect(html).not.toContain("Run migration");
  });

  test("24 cart draft count is shown as preserved durable state", async () => {
    const { controller } = await readyController({
      recovery: recovery({ cartDraftCount: 4 }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-cart-draft-count="4"');
    expect(html).toContain(DURABLE_STATE_COPY);
  });

  test("25 pending journal entries are shown as durable unresolved operations", async () => {
    const { controller } = await readyController({
      recovery: recovery({
        pendingOperationCount: 5,
        recommendedActions: ["RESOLVE_PENDING_OPERATIONS"],
      }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-pending-journal-count="5"');
    expect(html).toContain("durable unresolved operations");
  });

  test("26 attention operations are differentiated from ordinary pending operations", async () => {
    const { controller } = await readyController({
      recovery: recovery({
        pendingOperationCount: 5,
        attentionOperationCount: 2,
        recommendedActions: ["RESOLVE_PENDING_OPERATIONS", "REVIEW_ATTENTION_OPERATIONS"],
      }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-attention-journal-count="2"');
    expect(html).toContain("need review rather than blind replay");
    expect(html).toContain("not ordinary pending");
  });

  test("27 rebuildable catalog data is described as rebuildable", async () => {
    const { controller } = await readyController({
      recovery: recovery({
        rebuildableCatalogItemCount: 0,
        recommendedActions: ["REBUILD_CATALOG_IF_NEEDED"],
      }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-rebuildable-catalog-count="0"');
    expect(html).toContain("can be rebuilt");
  });

  test("28 no destructive-reset action is present", async () => {
    const { controller } = await readyController({
      recovery: recovery({ destructiveResetAllowed: false }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-destructive-reset-allowed="false"');
    expect(html).toContain('data-no-destructive-reset=""');
    expect(html.toLowerCase()).not.toContain("reset all data");
    expect(html).not.toMatch(/<button[^>]*>\s*[^<]*reset/i);
  });

  test("29 recovery state never tells cashier to wipe IndexedDB/local business data", async () => {
    const { controller } = await readyController({
      recovery: recovery({
        schemaCompatible: false,
        localSchema: 2,
        expectedSchema: 4,
        cartDraftCount: 3,
        pendingOperationCount: 1,
        recommendedActions: ["MIGRATE_LOCAL_SCHEMA", "RESOLVE_PENDING_OPERATIONS"],
      }),
    });
    const html = renderScreen(controller.getSession());
    expect(containsForbiddenRecoveryCopy(html)).toBe(false);
    expect(html.toLowerCase()).not.toContain("clear app data and start over");
  });

  test("30 offline state is explicit", async () => {
    const { controller } = await readyController({
      lifecycle: lifecycle({ connectivity: "offline" }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-connectivity="offline"');
    expect(html).toContain('data-offline-banner="offline"');
    expect(html).toContain("This device is offline");
  });

  test("31 reconnect does not automatically mark unknown operations successful or failed", async () => {
    const { controller } = await readyController({
      lifecycle: lifecycle({ connectivity: "checking", unknownOperationPresent: true }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain("Checking connection");
    expect(html).toContain("Do not assume they succeeded or failed");
    const unknown = html.match(/data-unknown-operation=""[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(unknown.toLowerCase()).not.toContain("successful");
    expect(unknown.toLowerCase()).not.toContain("failed");
  });

  test("32 durable local state messaging remains present offline", async () => {
    const { controller } = await readyController({
      lifecycle: lifecycle({ connectivity: "offline" }),
      recovery: recovery({ cartDraftCount: 1, pendingOperationCount: 1 }),
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain(DURABLE_STATE_COPY);
    expect(html).toContain('data-cart-draft-count="1"');
  });

  test("33 key blocking state has semantic status/alert coverage", async () => {
    const { controller } = await readyController({
      lifecycle: lifecycle({ updateReady: true, leadership: "active" }),
      activation: { safe: false, reasons: ["ACTIVE_TENDER"] },
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-update-block-reason="ACTIVE_TENDER"');
  });

  test("34 disabled actions have textual explanation", async () => {
    const { controller } = await readyController({
      lifecycle: lifecycle({ updateReady: true }),
      activation: { safe: false, reasons: ["CRITICAL_OPERATION_PENDING"] },
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain('data-update-disabled-reason=""');
    expect(html).toContain("Update activation is unavailable");
  });

  test("35 feature remains usable at phone-size layout", async () => {
    const css = healthCss();
    expect(css).toContain("max-width: 480px");
    expect(css).toContain("max-width: 820px");
    const { controller } = await readyController({
      lifecycle: lifecycle({ updateReady: true }),
      activation: { safe: false, reasons: ["ACTIVE_TENDER"] },
    });
    const html = renderScreen(controller.getSession());
    expect(html).toContain("data-phone-layout");
    expect(html).toContain("store-health-stack");
    expect(html).toContain('role="alert"');
    expect(html).toContain("An active payment or tender is in progress");
  });
});
