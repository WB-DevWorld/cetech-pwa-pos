import type { StaffRuntimeAuthority } from "./staff-runtime";

const STORAGE_KEY = "cetech-pos:offline-staff-presentation:v1";
export const OFFLINE_STAFF_PRESENTATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

type StoredOfflinePresentation = {
  readonly version: 1;
  readonly verifiedAt: string;
  readonly authority: StaffRuntimeAuthority;
};

export type OfflineStaffPresentationStore = {
  read(now?: Date): StaffRuntimeAuthority | null;
  write(authority: StaffRuntimeAuthority, now?: Date): void;
  clear(): void;
};

function validStoredAuthority(
  value: unknown,
  now: Date,
): StaffRuntimeAuthority | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<StoredOfflinePresentation>;
  if (record.version !== 1 || typeof record.verifiedAt !== "string" || !record.authority) {
    return null;
  }
  const verifiedAt = Date.parse(record.verifiedAt);
  if (!Number.isFinite(verifiedAt) || now.getTime() - verifiedAt > OFFLINE_STAFF_PRESENTATION_MAX_AGE_MS) {
    return null;
  }
  const authority = record.authority;
  if (authority.status !== "ready" || !authority.session) return null;
  const sessionExpiry = Date.parse(authority.session.expiresAt);
  if (!Number.isFinite(sessionExpiry) || sessionExpiry <= now.getTime()) return null;

  return {
    ...authority,
    presentationOnly: true,
    errorMessage: "Offline. Showing the last verified cashier and register. Selling and register changes stay blocked until reconnect.",
  };
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
  return {
    read(now = new Date()) {
      const storage = browserStorage();
      if (!storage) return fallback.read(now);
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return validStoredAuthority(JSON.parse(raw), now);
      } catch {
        return fallback.read(now);
      }
    },
    write(authority, now = new Date()) {
      if (authority.status !== "ready" || !authority.session || authority.presentationOnly) return;
      const { errorMessage: _errorMessage, ...presentation } = authority;
      void _errorMessage;
      const snapshot: StoredOfflinePresentation = {
        version: 1,
        verifiedAt: now.toISOString(),
        authority: {
          ...presentation,
          presentationOnly: false,
        },
      };
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
    read(now = new Date()) {
      return validStoredAuthority(stored, now);
    },
    write(authority, now = new Date()) {
      if (authority.status !== "ready" || !authority.session || authority.presentationOnly) return;
      const { errorMessage: _errorMessage, ...presentation } = authority;
      void _errorMessage;
      stored = {
        version: 1,
        verifiedAt: now.toISOString(),
        authority: {
          ...presentation,
          presentationOnly: false,
        },
      };
    },
    clear() {
      stored = null;
    },
  };
}
