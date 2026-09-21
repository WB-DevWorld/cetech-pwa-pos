import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ReleasePolicy } from "../../../../docs/contracts/domain.generated";
import { createServiceWorkerLifecycle } from "./service-worker-lifecycle";
import { RELEASE_POLICY_PATH, serviceWorkerUrlForBuild } from "./release-policy-client";
import type { UpdateSafetySnapshot } from "./pwa-lifecycle";
import { deletePosLocalDatabase } from "./pos-local-db";

const workerSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const lifecycleSource = readFileSync(new URL("./service-worker-lifecycle.ts", import.meta.url), "utf8");
const workspaceRuntimeSource = readFileSync(new URL("../app/workspace-runtime.tsx", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const sellPageSource = readFileSync(new URL("../app/sell/page.tsx", import.meta.url), "utf8");
const homePageSource = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const runtimeSource = readFileSync(new URL("../app/pwa-lifecycle-runtime.tsx", import.meta.url), "utf8");
const manifest = JSON.parse(
  readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8"),
) as Record<string, unknown>;

const POLICY_B: ReleasePolicy = {
  latestBuild: "1.0.1",
  recommendedBuild: "1.0.1",
  minimumSupportedBuild: "1.0.0",
  minimumApiVersion: "1.0.0",
  minimumLocalSchema: 4,
};

const A_SHA = "1111111111111111111111111111111111111111";
const B_SHA = "2222222222222222222222222222222222222222";
const SHA_POLICY_B: ReleasePolicy = {
  latestBuild: B_SHA,
  recommendedBuild: B_SHA,
  minimumSupportedBuild: B_SHA,
  minimumApiVersion: "1.0.0",
  minimumLocalSchema: 4,
};

function snapshot(overrides: Partial<UpdateSafetySnapshot> = {}): UpdateSafetySnapshot {
  return {
    activeTender: false,
    criticalOperationCount: 0,
    syncMutationInProgress: false,
    localMigrationInProgress: false,
    activeWindow: true,
    appBuild: "1.0.0",
    releasePolicy: POLICY_B,
    ...overrides,
  };
}

type FakeWorker = {
  state: string;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: (type: string, listener: () => void) => void;
  listeners: Record<string, Array<() => void>>;
};

function createFakeWorker(state = "installed"): FakeWorker {
  const listeners: Record<string, Array<() => void>> = {};
  return {
    state,
    postMessage: vi.fn(),
    listeners,
    addEventListener(type, listener) {
      listeners[type] ??= [];
      listeners[type].push(listener);
    },
  };
}

function installBrowserFakes() {
  const visibility = { state: "visible" };
  const documentListeners: Record<string, Array<() => void>> = {};
  const windowListeners: Record<string, Array<() => void>> = {};
  const registrations: Array<{ scriptURL: string; waiting: FakeWorker | null; update: ReturnType<typeof vi.fn> }> =
    [];

  const register = vi.fn(async (url: string) => {
    const waiting = createFakeWorker("installed");
    const registration = {
      scriptURL: `https://cetech-pos.local${url}`,
      installing: null as FakeWorker | null,
      waiting,
      update: vi.fn(async () => undefined),
      addEventListener: vi.fn(),
    };
    registrations.push(registration);
    return registration;
  });

  vi.stubGlobal("window", {
    addEventListener: (type: string, listener: () => void) => {
      windowListeners[type] ??= [];
      windowListeners[type].push(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      windowListeners[type] = (windowListeners[type] ?? []).filter((item) => item !== listener);
    },
  });
  vi.stubGlobal("document", {
    get visibilityState() {
      return visibility.state;
    },
    addEventListener: (type: string, listener: () => void) => {
      documentListeners[type] ??= [];
      documentListeners[type].push(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      documentListeners[type] = (documentListeners[type] ?? []).filter((item) => item !== listener);
    },
  });
  vi.stubGlobal("navigator", {
    onLine: true,
    serviceWorker: {
      controller: {},
      register,
    },
  });

  return { register, registrations, documentListeners, windowListeners, visibility };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  await deletePosLocalDatabase();
});

describe("CORE-07 service worker safety invariants", () => {
  test("waiting updates are activated only by the explicit CORE-07 message", () => {
    expect(workerSource).toContain('event.data?.type === "CORE07_ACTIVATE_WAITING_UPDATE"');
    expect(workerSource).toContain("self.skipWaiting()");
    const installBlock = workerSource.slice(
      workerSource.indexOf('self.addEventListener("install"'),
      workerSource.indexOf('self.addEventListener("activate"'),
    );
    expect(installBlock).not.toContain("self.skipWaiting()");
    expect(lifecycleSource).not.toContain("skipWaiting");
  });

  test("each release can register a build-specific worker and cache namespace", () => {
    expect(lifecycleSource).toContain("shouldDiscoverAdvertisedWorker");
    expect(lifecycleSource).toContain("serviceWorkerUrlForBuild(policy.latestBuild)");
    expect(lifecycleSource).toContain("navigator.serviceWorker.register(workerUrl");
    expect(workerSource).toContain('WORKER_URL.searchParams.get("build")');
    expect(workerSource).toContain('`cetech-pos-shell-${BUILD_ID}`');
    expect(serviceWorkerUrlForBuild("1.0.0")).not.toBe(serviceWorkerUrlForBuild("1.0.1"));
  });

  test("API/business responses stay uncached while the replaceable POS shell supports offline launch", () => {
    const apiGuard = 'if (url.pathname.startsWith("/api/")) return;';
    const staticBranch = 'if (url.pathname.startsWith("/_next/static/")) {';
    const navigationBranch = 'if (request.mode === "navigate") {';

    const apiGuardIndex = workerSource.indexOf(apiGuard);
    const staticBranchIndex = workerSource.indexOf(staticBranch);
    const navigationBranchIndex = workerSource.indexOf(navigationBranch);

    expect(apiGuardIndex).toBeGreaterThanOrEqual(0);
    expect(staticBranchIndex).toBeGreaterThan(apiGuardIndex);
    expect(navigationBranchIndex).toBeGreaterThan(staticBranchIndex);

    const staticCacheBlock = workerSource.slice(staticBranchIndex, navigationBranchIndex);
    expect(staticCacheBlock).toContain("cache.put(request, response.clone())");

    expect(workerSource).toContain('const APP_SHELL_URL = "/"');
    expect(workerSource).toContain("cacheAppShell(cache)");
    expect(workerSource).toContain("shellAssetPaths(html)");
    expect(workerSource).toContain('contentType.includes("text/html")');
    expect(workerSource).toContain("cache.put(request, response.clone())");

    const navigationBlock = workerSource.slice(navigationBranchIndex);
    expect(navigationBlock).toContain("cache.match(request, { ignoreSearch: true })");
    expect(navigationBlock).toContain("cache.match(APP_SHELL_URL)");
    expect(navigationBlock).toContain("cache.match(OFFLINE_URL)");
    expect(navigationBlock).not.toContain('url.pathname.startsWith("/api/")');
  });

  test("worker installation keeps a real app-shell fallback without destructive cache semantics", () => {
    const installBlock = workerSource.slice(
      workerSource.indexOf('self.addEventListener("install"'),
      workerSource.indexOf('self.addEventListener("activate"'),
    );
    expect(installBlock).toContain("cache.add(OFFLINE_URL)");
    expect(installBlock).toContain("cacheAppShell(cache)");
    expect(workerSource).toContain('fetch(APP_SHELL_URL, { cache: "no-store" })');
    expect(workerSource).not.toContain("indexedDB.deleteDatabase");
    expect(workerSource).not.toContain("localStorage.clear");
  });

  test("manifest is standalone and uses the controlled root scope", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
  });
});

describe("installed build A discovers deployed build B", () => {
  test("release-policy discovery registers worker B while the running app remains A", async () => {
    const fakes = installBrowserFakes();
    const onUpdateReady = vi.fn();
    const fetchPolicy = vi.fn(async () => POLICY_B);
    const lifecycle = createServiceWorkerLifecycle({
      ownerId: "tab-a",
      appBuild: "1.0.0",
      fetchReleasePolicy: fetchPolicy,
      getSafetySnapshot: () => snapshot(),
      onUpdateReady,
    });

    await lifecycle.start();

    expect(fetchPolicy).toHaveBeenCalled();
    expect(fakes.register).toHaveBeenCalledWith("/sw.js?build=1.0.1", { scope: "/" });
    expect(fakes.register).not.toHaveBeenCalledWith("/sw.js?build=1.0.0", expect.anything());
    expect(lifecycle.discoveredWorkerUrl()).toBe("/sw.js?build=1.0.1");
    expect(onUpdateReady).toHaveBeenCalled();
    expect(fakes.registrations[0]?.waiting?.postMessage).not.toHaveBeenCalled();
  });

  test("exact SHA A→B discovery stays safe and activates the waiting B worker", async () => {
    const fakes = installBrowserFakes();
    const onUpdateReady = vi.fn();
    const lifecycle = createServiceWorkerLifecycle({
      ownerId: "tab-sha-a",
      appBuild: A_SHA,
      fetchReleasePolicy: async () => SHA_POLICY_B,
      getSafetySnapshot: () => snapshot({ appBuild: A_SHA, releasePolicy: SHA_POLICY_B }),
      onUpdateReady,
    });

    await lifecycle.start();

    expect(fakes.register).toHaveBeenCalledWith(`/sw.js?build=${B_SHA}`, { scope: "/" });
    expect(lifecycle.discoveredWorkerUrl()).toBe(`/sw.js?build=${B_SHA}`);
    expect(onUpdateReady).toHaveBeenCalled();
    expect(fakes.registrations[0]?.waiting).toBeTruthy();

    const decision = await lifecycle.activationDecision();
    expect(decision).toEqual({ safe: true });
    expect(JSON.stringify(decision)).not.toContain("UNSUPPORTED_APP_VERSION");

    const activation = await lifecycle.activateWaitingUpdate();
    expect(activation).toEqual({ safe: true });
    expect(fakes.registrations[0]?.waiting?.postMessage).toHaveBeenCalledWith({
      type: "CORE07_ACTIVATE_WAITING_UPDATE",
    });
  });

  test("orderable unsupported versions still block waiting-worker activation", async () => {
    const fakes = installBrowserFakes();
    const policy: ReleasePolicy = {
      latestBuild: "1.5.0",
      recommendedBuild: "1.5.0",
      minimumSupportedBuild: "1.4.0",
      minimumApiVersion: "1.0.0",
      minimumLocalSchema: 4,
    };
    const lifecycle = createServiceWorkerLifecycle({
      ownerId: "tab-unsupported",
      appBuild: "1.3.9",
      fetchReleasePolicy: async () => policy,
      getSafetySnapshot: () => snapshot({ appBuild: "1.3.9", releasePolicy: policy }),
      onUpdateReady: () => undefined,
    });

    await lifecycle.start();
    const decision = await lifecycle.activateWaitingUpdate();

    expect(fakes.register).toHaveBeenCalledWith("/sw.js?build=1.5.0", { scope: "/" });
    expect(decision).toEqual({ safe: false, reasons: ["UNSUPPORTED_APP_VERSION"] });
    expect(fakes.registrations[0]?.waiting?.postMessage).not.toHaveBeenCalled();
  });

  test("a waiting B worker stays waiting while tender, critical work, or a passive window blocks activation", async () => {
    const fakes = installBrowserFakes();
    const lifecycle = createServiceWorkerLifecycle({
      ownerId: "tab-a",
      appBuild: "1.0.0",
      fetchReleasePolicy: async () => POLICY_B,
      getSafetySnapshot: () =>
        snapshot({
          activeTender: true,
          criticalOperationCount: 1,
          activeWindow: false,
        }),
      onUpdateReady: () => undefined,
    });

    await lifecycle.start();
    const decision = await lifecycle.activateWaitingUpdate();

    expect(decision).toEqual({
      safe: false,
      reasons: ["PASSIVE_WINDOW", "ACTIVE_TENDER", "CRITICAL_OPERATION_PENDING"],
    });
    expect(fakes.registrations[0]?.waiting?.postMessage).not.toHaveBeenCalled();
  });

  test("foreground, reconnect, and long-session checks re-run release discovery", async () => {
    const fakes = installBrowserFakes();
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    let now = 1_000;
    const fetchPolicy = vi.fn(async () => POLICY_B);
    const lifecycle = createServiceWorkerLifecycle({
      ownerId: "tab-a",
      appBuild: "1.0.0",
      fetchReleasePolicy: fetchPolicy,
      getSafetySnapshot: () => snapshot(),
      onUpdateReady: () => undefined,
      now: () => now,
      checkThrottleMs: 1_000,
      longSessionCheckMs: 5_000,
    });

    await lifecycle.start();
    expect(fetchPolicy).toHaveBeenCalledTimes(1);
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 5_000);

    now = 3_000;
    fakes.visibility.state = "visible";
    for (const listener of fakes.documentListeners.visibilitychange ?? []) {
      listener();
    }
    await vi.waitFor(() => expect(fetchPolicy).toHaveBeenCalledTimes(2));

    now = 5_000;
    for (const listener of fakes.windowListeners.online ?? []) {
      listener();
    }
    await vi.waitFor(() => expect(fetchPolicy).toHaveBeenCalledTimes(3));

    now = 12_000;
    const scheduled = intervalSpy.mock.calls[0]?.[0];
    expect(typeof scheduled).toBe("function");
    (scheduled as () => void)();
    await vi.waitFor(() => expect(fetchPolicy).toHaveBeenCalledTimes(4));

    lifecycle.stop();
    intervalSpy.mockRestore();
  });
});

describe("shared lifecycle composition", () => {
  test("layout owns the lifecycle runtime during ordinary Sell use", () => {
    expect(layoutSource).toContain("PwaLifecycleRuntime");
    expect(layoutSource).toContain("appBuild={env.buildId}");
    expect(sellPageSource).toContain("pos-route-slot");
    expect(homePageSource).toContain("pos-route-slot");
    expect(sellPageSource).not.toContain("createServiceWorkerLifecycle");
    expect(homePageSource).not.toContain("createServiceWorkerLifecycle");
    expect(runtimeSource).toContain("createServiceWorkerLifecycle");
    expect(runtimeSource).toContain("bindPwaLifecycleEffects");
  });

  test("System status consumes shared lifecycle state without constructing a second controller", () => {
    expect(workspaceRuntimeSource).toContain("usePwaLifecycle");
    expect(workspaceRuntimeSource).not.toContain("createServiceWorkerLifecycle");
    expect(workspaceRuntimeSource).toContain("inspectLocalRecoveryState");
    expect(workspaceRuntimeSource).toContain("lifecycle.checkForUpdate()");
  });

  test("release discovery uses the canonical no-store endpoint rather than the current bundle identity", () => {
    expect(lifecycleSource).toContain("fetchReleasePolicy");
    expect(lifecycleSource).toContain("policy.latestBuild");
    expect(RELEASE_POLICY_PATH).toBe("/api/pos/v1/release-policy");
  });
});
