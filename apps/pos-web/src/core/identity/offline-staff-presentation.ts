import type { StaffRuntimeAuthority } from "./staff-runtime";

const STORAGE_KEY = "cetech-pos:offline-staff-presentation:v1";

/**
 * Repository policy: a previously verified cashier may be presented offline
 * for 24 hours after the verification instant recorded on this device.
 * The browser clock is not a trusted time source. Setting it backward
 * before this snapshot is read can extend the window. Once a read observes
 * that the grace has elapsed, the snapshot is retired, so a later backward
 * clock change cannot revive it. Reconnect must revalidate with the server
 * before commercial actions return. An expired online session does not
 * shorten this window and does not extend it.
 */
export const OFFLINE_STAFF_PRESENTATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const OFFLINE_GRACE_EXPIRED_MESSAGE =
  "Offline access expired. Sign in again when you are online. Saved cart and transaction checks stay on this device.";

type StoredOfflinePresentation = {
  readonly version: 1;
  readonly verifiedAt: string;
  readonly authority: StaffRuntimeAuthority;
};

export type OfflinePresentationEvaluation =
  | { readonly outcome: "available"; readonly authority: StaffRuntimeAuthority }
  | { readonly outcome: "absent" }
  | { readonly outcome: "grace_expired" }
  | { readonly outcome: "invalid" };

export type OfflineStaffPresentationStore = {
  read(now?: Date): StaffRuntimeAuthority | null;
  evaluate(now?: Date): OfflinePresentationEvaluation;
  write(authority: StaffRuntimeAuthority, now?: Date): void;
  clear(): void;
};

export function formatOfflineVerifiedAt(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Date(parsed).toISOString().replace(".000Z", " UTC").replace("T", " ");
}

export function offlineVerifiedPresentationMessage(verifiedAt: string): string {
  return `Offline — staff access last verified at ${formatOfflineVerifiedAt(verifiedAt)}. Selling and register changes stay blocked until reconnect.`;
}

export function offlinePresentationBanner(input: {
  readonly online: boolean;
  readonly lastVerifiedAt?: string;
}): { readonly title: string; readonly detail: string } {
  const verified = input.lastVerifiedAt ? formatOfflineVerifiedAt(input.lastVerifiedAt) : null;
  const title = input.online
    ? "Connection unavailable."
    : verified
      ? `Offline — staff access last verified at ${verified}.`
      : "Offline.";
  const availability = input.online ? "the service recovers." : "reconnect.";
  const verifiedClause = input.online && verified ? ` Staff access last verified at ${verified}.` : "";
  return {
    title,
    detail:
      `Showing the last verified cashier, register, saved products and cart. Payments, authoritative pricing, returns and register changes stay unavailable until ${availability}${verifiedClause}`,
  };
}

function snapshotFrom(authority: StaffRuntimeAuthority, now: Date): StoredOfflinePresentation | null {
  if (authority.status !== "ready" || !authority.session || authority.presentationOnly) return null;
  const organizationId = authority.session.organizationId.trim();
  const actorId = authority.session.actorId.trim();
  if (!organizationId || !actorId) return null;
  if (!Number.isFinite(Date.parse(authority.session.expiresAt))) return null;
  const { errorMessage: _errorMessage, lastVerifiedAt: _lastVerifiedAt, ...presentation } = authority;
  void _errorMessage;
  void _lastVerifiedAt;
  return {
    version: 1,
    verifiedAt: now.toISOString(),
    authority: {
      ...presentation,
      presentationOnly: false,
      session: {
        ...authority.session,
        organizationId,
        actorId,
        capabilities: [],
      },
    },
  };
}

function evaluateStored(value: unknown, now: Date): OfflinePresentationEvaluation {
  if (value == null) return { outcome: "absent" };
  if (typeof value !== "object") return { outcome: "invalid" };
  const record = value as Partial<StoredOfflinePresentation>;
  if (record.version !== 1 || typeof record.verifiedAt !== "string" || !record.authority) {
    return { outcome: "invalid" };
  }
  const verifiedAt = Date.parse(record.verifiedAt);
  if (!Number.isFinite(verifiedAt)) return { outcome: "invalid" };
  if (now.getTime() - verifiedAt > OFFLINE_STAFF_PRESENTATION_MAX_AGE_MS) {
    return { outcome: "grace_expired" };
  }
  const authority = record.authority;
  const organizationId = authority.session?.organizationId?.trim() ?? "";
  const actorId = authority.session?.actorId?.trim() ?? "";
  if (authority.status !== "ready" || !authority.session || !organizationId || !actorId) {
    return { outcome: "invalid" };
  }
  if (!Number.isFinite(Date.parse(authority.session.expiresAt))) return { outcome: "invalid" };

  const verifiedAtIso = new Date(verifiedAt).toISOString();
  return {
    outcome: "available",
    authority: {
      ...authority,
      session: {
        ...authority.session,
        organizationId,
        actorId,
        capabilities: [],
      },
      presentationOnly: true,
      lastVerifiedAt: verifiedAtIso,
      errorMessage: offlineVerifiedPresentationMessage(verifiedAtIso),
    },
  };
}

function consume(value: unknown, now: Date, retire: () => void): OfflinePresentationEvaluation {
  const evaluation = evaluateStored(value, now);
  if (evaluation.outcome === "grace_expired" || evaluation.outcome === "invalid") {
    retire();
  }
  return evaluation;
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createLocalOfflineStaffPresentationStore(): OfflineStaffPresentationStore {
  const fallback = createMemoryOfflineStaffPresentationStore();
  function load(): unknown {
    const storage = browserStorage();
    if (!storage) return undefined;
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  }
  return {
    evaluate(now = new Date()) {
      const storage = browserStorage();
      if (!storage) return fallback.evaluate(now);
      try {
        return consume(load(), now, () => {
          storage.removeItem(STORAGE_KEY);
        });
      } catch {
        try {
          storage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore storage failures and fail closed.
        }
        return { outcome: "invalid" };
      }
    },
    read(now = new Date()) {
      const evaluation = this.evaluate(now);
      return evaluation.outcome === "available" ? evaluation.authority : null;
    },
    write(authority, now = new Date()) {
      const snapshot = snapshotFrom(authority, now);
      if (!snapshot) return;
      const storage = browserStorage();
      if (!storage) {
        fallback.write(authority, now);
        return;
      }
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        fallback.write(authority, now);
      }
    },
    clear() {
      const storage = browserStorage();
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        // Fall through to memory cleanup.
      }
      fallback.clear();
    },
  };
}

export function createMemoryOfflineStaffPresentationStore(): OfflineStaffPresentationStore {
  let stored: StoredOfflinePresentation | null = null;
  return {
    evaluate(now = new Date()) {
      return consume(stored, now, () => {
        stored = null;
      });
    },
    read(now = new Date()) {
      const evaluation = this.evaluate(now);
      return evaluation.outcome === "available" ? evaluation.authority : null;
    },
    write(authority, now = new Date()) {
      stored = snapshotFrom(authority, now);
    },
    clear() {
      stored = null;
    },
  };
}
