import {
  acquireLifecycleLease,
  assessUpdateActivation,
  type UpdateActivationDecision,
  type UpdateSafetySnapshot,
} from "./pwa-lifecycle";

export interface ServiceWorkerLifecycleOptions {
  readonly ownerId: string;
  readonly getSafetySnapshot: () => Promise<UpdateSafetySnapshot> | UpdateSafetySnapshot;
  readonly onUpdateReady: () => void;
  readonly onUnsupported?: () => void;
  readonly workerUrl?: string;
  readonly checkThrottleMs?: number;
  readonly longSessionCheckMs?: number;
  readonly now?: () => number;
}

export interface ServiceWorkerLifecycleController {
  start(): Promise<void>;
  stop(): void;
  checkForUpdate(force?: boolean): Promise<void>;
  activationDecision(): Promise<UpdateActivationDecision>;
  activateWaitingUpdate(): Promise<UpdateActivationDecision>;
}

const DEFAULT_CHECK_THROTTLE_MS = 5 * 60 * 1000;
const DEFAULT_LONG_SESSION_CHECK_MS = 30 * 60 * 1000;
const LEASE_TTL_MS = 20_000;

/**
 * Browser-side lifecycle coordinator. It is framework-neutral so FE-07 can bind
 * the final UX without moving update authority into React components.
 */
export function createServiceWorkerLifecycle(
  options: ServiceWorkerLifecycleOptions,
): ServiceWorkerLifecycleController {
  const now = options.now ?? (() => Date.now());
  const throttleMs = options.checkThrottleMs ?? DEFAULT_CHECK_THROTTLE_MS;
  const intervalMs = options.longSessionCheckMs ?? DEFAULT_LONG_SESSION_CHECK_MS;
  const workerUrl = options.workerUrl ?? "/sw.js";
  let registration: ServiceWorkerRegistration | null = null;
  let lastCheckAt = Number.NEGATIVE_INFINITY;
  let interval: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  const foregroundListener = () => {
    if (document.visibilityState === "visible") {
      void controller.checkForUpdate();
    }
  };
  const onlineListener = () => void controller.checkForUpdate();

  function observeRegistration(next: ServiceWorkerRegistration): void {
    registration = next;
    if (next.waiting) {
      options.onUpdateReady();
    }
    next.addEventListener("updatefound", () => {
      const installing = next.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          options.onUpdateReady();
        }
      });
    });
  }

  const controller: ServiceWorkerLifecycleController = {
    async start() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || stopped) {
        return;
      }
      const next = await navigator.serviceWorker.register(workerUrl, { scope: "/" });
      observeRegistration(next);
      document.addEventListener("visibilitychange", foregroundListener);
      window.addEventListener("online", onlineListener);
      interval = setInterval(() => void controller.checkForUpdate(), intervalMs);
      await controller.checkForUpdate(true);
    },

    stop() {
      stopped = true;
      if (typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", foregroundListener);
        window.removeEventListener("online", onlineListener);
      }
      if (interval) clearInterval(interval);
      interval = undefined;
    },

    async checkForUpdate(force = false) {
      if (stopped || !registration) return;
      const current = now();
      if (!force && current - lastCheckAt < throttleMs) return;
      lastCheckAt = current;
      try {
        await registration.update();
        if (registration.waiting) options.onUpdateReady();
      } catch {
        // Connectivity/update-check failure is not a reason to discard local state.
      }
    },

    async activationDecision() {
      const decision = assessUpdateActivation(await options.getSafetySnapshot());
      if (!decision.safe && decision.reasons.includes("UNSUPPORTED_APP_VERSION")) {
        options.onUnsupported?.();
      }
      return decision;
    },

    async activateWaitingUpdate() {
      const initial = await controller.activationDecision();
      if (!initial.safe || !registration?.waiting) return initial;

      const leased = await acquireLifecycleLease(options.ownerId, now(), LEASE_TTL_MS);
      if (!leased) {
        return { safe: false, reasons: ["PASSIVE_WINDOW"] };
      }

      // Recheck after winning leadership; transaction state may have changed while
      // this tab was competing for the lease.
      const finalDecision = await controller.activationDecision();
      if (!finalDecision.safe) return finalDecision;

      registration.waiting.postMessage({ type: "CORE07_ACTIVATE_WAITING_UPDATE" });
      return { safe: true };
    },
  };

  return controller;
}
