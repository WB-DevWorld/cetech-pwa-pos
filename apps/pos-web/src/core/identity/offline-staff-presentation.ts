import type { Register, Shift } from "../../../../../docs/contracts/domain.generated";
import type { StaffRuntimeAuthority } from "./staff-runtime";

export const OFFLINE_STAFF_PRESENTATION_STORAGE_KEY = "cetech-pos:offline-staff-presentation:v1";
const STORAGE_KEY = OFFLINE_STAFF_PRESENTATION_STORAGE_KEY;

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

const REGISTER_STATUSES = ["active", "disabled", "maintenance"] as const;
const SHIFT_STATUSES = ["open", "closing", "closed", "requires_attention"] as const;

type RegisterStatus = (typeof REGISTER_STATUSES)[number];
type ShiftStatus = (typeof SHIFT_STATUSES)[number];

/**
 * Last verified register labels. `status` is the status observed at
 * verification so the display object can be rebuilt. It is not permission
 * to operate the register.
 */
export type StoredOfflineRegisterPresentationV1 = {
  readonly id: string;
  readonly name: string;
  readonly locationId: string;
  readonly currency: string;
  readonly status: RegisterStatus;
};

/**
 * Last verified shift labels. Cash amounts, device id, and cashier id are
 * not stored. `status` is display context, not an open-shift grant.
 */
export type StoredOfflineShiftPresentationV1 = {
  readonly id: string;
  readonly registerId: string;
  readonly status: ShiftStatus;
  readonly openedAt: string;
};

/**
 * Allowlisted offline presentation. Every persisted field is named here.
 * This is not a `StaffRuntimeAuthority`. Cached register and shift values
 * are presentation of the last verified context, not current authority.
 * The live session has no display-only operational role separate from
 * capabilities, and capabilities are not stored.
 */
export type StoredOfflineStaffPresentationV1 = {
  readonly version: 1;
  readonly verifiedAt: string;
  readonly organizationId: string;
  readonly actorId: string;
  readonly displayName: string;
  readonly locationIds: readonly string[];
  /** Server session expiry observed at verification. Grace does not consult it. */
  readonly sessionExpiresAt: string;
  readonly register: StoredOfflineRegisterPresentationV1 | null;
  readonly shift: StoredOfflineShiftPresentationV1 | null;
};

export const STORED_OFFLINE_STAFF_PRESENTATION_KEYS = [
  "version",
  "verifiedAt",
  "organizationId",
  "actorId",
  "displayName",
  "locationIds",
  "sessionExpiresAt",
  "register",
  "shift",
] as const;

export const STORED_OFFLINE_REGISTER_PRESENTATION_KEYS = [
  "id",
  "name",
  "locationId",
  "currency",
  "status",
] as const;

export const STORED_OFFLINE_SHIFT_PRESENTATION_KEYS = [
  "id",
  "registerId",
  "status",
  "openedAt",
] as const;

export type OfflinePresentationEvaluation =
  | { readonly outcome: "available"; readonly authority: StaffRuntimeAuthority }
  | { readonly outcome: "absent" }
  | { readonly outcome: "grace_expired" }
  | { readonly outcome: "invalid" };

export type OfflineStaffPresentationStore = {
  read(now?: Date): StaffRuntimeAuthority | null;
  evaluate(now?: Date): OfflinePresentationEvaluation;
  write(authority: StaffRuntimeAuthority, now?: Date): void;
  /** Canonical JSON of the allowlisted snapshot, or null when nothing is stored. */
  serializedSnapshot(): string | null;
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

function trimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  return next ? next : null;
}

function copyIds(values: readonly string[]): string[] {
  const next: string[] = [];
  for (const value of values) {
    const id = trimmed(value);
    if (id) next.push(id);
  }
  return next;
}

function isRegisterStatus(value: string): value is RegisterStatus {
  return REGISTER_STATUSES.some((status) => status === value);
}

function isShiftStatus(value: string): value is ShiftStatus {
  return SHIFT_STATUSES.some((status) => status === value);
}

function registerPresentation(authority: StaffRuntimeAuthority): StoredOfflineRegisterPresentationV1 | null {
  const register = authority.register;
  if (!register) return null;
  const id = trimmed(register.id);
  const name = trimmed(register.name);
  const locationId = trimmed(register.locationId);
  const currency = trimmed(register.currency);
  const status = trimmed(register.status);
  if (!id || !name || !locationId || !currency || !status || !isRegisterStatus(status)) return null;
  return { id, name, locationId, currency, status };
}

function shiftPresentation(authority: StaffRuntimeAuthority): StoredOfflineShiftPresentationV1 | null {
  const shift = authority.shift;
  if (!shift) return null;
  const id = trimmed(shift.id);
  const registerId = trimmed(shift.registerId);
  const status = trimmed(shift.status);
  const openedAt = Date.parse(shift.openedAt);
  if (!id || !registerId || !status || !isShiftStatus(status) || !Number.isFinite(openedAt)) return null;
  return {
    id,
    registerId,
    status,
    openedAt: new Date(openedAt).toISOString(),
  };
}

/**
 * Builds the persisted snapshot by naming each field. Live authority objects
 * are not spread, so fields added to `StaffRuntimeAuthority` later are not stored.
 */
export function buildStoredOfflineStaffPresentation(
  authority: StaffRuntimeAuthority,
  now: Date,
): StoredOfflineStaffPresentationV1 | null {
  if (authority.status !== "ready" || !authority.session || authority.presentationOnly) return null;
  const organizationId = trimmed(authority.session.organizationId);
  const actorId = trimmed(authority.session.actorId);
  const displayName = trimmed(authority.session.displayName);
  const sessionExpiresAt = trimmed(authority.session.expiresAt);
  if (!organizationId || !actorId || !displayName || !sessionExpiresAt) return null;
  if (!Number.isFinite(Date.parse(sessionExpiresAt))) return null;
  return {
    version: 1,
    verifiedAt: now.toISOString(),
    organizationId,
    actorId,
    displayName,
    locationIds: copyIds(authority.session.locationIds),
    sessionExpiresAt,
    register: registerPresentation(authority),
    shift: shiftPresentation(authority),
  };
}

/** JSON written to storage. Unknown properties cannot survive this copy. */
export function serializeStoredOfflineStaffPresentation(snapshot: StoredOfflineStaffPresentationV1): string {
  const locationIds: string[] = [];
  for (const id of snapshot.locationIds) {
    locationIds.push(id);
  }
  return JSON.stringify({
    version: snapshot.version,
    verifiedAt: snapshot.verifiedAt,
    organizationId: snapshot.organizationId,
    actorId: snapshot.actorId,
    displayName: snapshot.displayName,
    locationIds,
    sessionExpiresAt: snapshot.sessionExpiresAt,
    register: snapshot.register
      ? {
          id: snapshot.register.id,
          name: snapshot.register.name,
          locationId: snapshot.register.locationId,
          currency: snapshot.register.currency,
          status: snapshot.register.status,
        }
      : null,
    shift: snapshot.shift
      ? {
          id: snapshot.shift.id,
          registerId: snapshot.shift.registerId,
          status: snapshot.shift.status,
          openedAt: snapshot.shift.openedAt,
        }
      : null,
  });
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function parseRegister(value: unknown): StoredOfflineRegisterPresentationV1 | null | undefined {
  if (value == null) return null;
  const source = record(value);
  if (!source) return undefined;
  const id = trimmed(source.id);
  const name = trimmed(source.name);
  const locationId = trimmed(source.locationId);
  const currency = trimmed(source.currency);
  const status = trimmed(source.status);
  if (!id || !name || !locationId || !currency || !status || !isRegisterStatus(status)) return undefined;
  return { id, name, locationId, currency, status };
}

function parseShift(value: unknown): StoredOfflineShiftPresentationV1 | null | undefined {
  if (value == null) return null;
  const source = record(value);
  if (!source) return undefined;
  const id = trimmed(source.id);
  const registerId = trimmed(source.registerId);
  const status = trimmed(source.status);
  const openedAt = trimmed(source.openedAt);
  if (!id || !registerId || !status || !openedAt || !isShiftStatus(status)) return undefined;
  if (!Number.isFinite(Date.parse(openedAt))) return undefined;
  return { id, registerId, status, openedAt: new Date(Date.parse(openedAt)).toISOString() };
}

function parseLocationIds(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const ids: string[] = [];
  for (const entry of value) {
    const id = trimmed(entry);
    if (!id) return null;
    ids.push(id);
  }
  return ids;
}

function parseStored(value: unknown): StoredOfflineStaffPresentationV1 | null {
  const source = record(value);
  if (!source || source.version !== 1) return null;
  const verifiedAt = trimmed(source.verifiedAt);
  const organizationId = trimmed(source.organizationId);
  const actorId = trimmed(source.actorId);
  const displayName = trimmed(source.displayName);
  const sessionExpiresAt = trimmed(source.sessionExpiresAt);
  const locationIds = parseLocationIds(source.locationIds);
  const register = parseRegister(source.register);
  const shift = parseShift(source.shift);
  if (
    !verifiedAt ||
    !organizationId ||
    !actorId ||
    !displayName ||
    !sessionExpiresAt ||
    !locationIds ||
    register === undefined ||
    shift === undefined ||
    !Number.isFinite(Date.parse(verifiedAt)) ||
    !Number.isFinite(Date.parse(sessionExpiresAt))
  ) {
    return null;
  }
  return {
    version: 1,
    verifiedAt: new Date(Date.parse(verifiedAt)).toISOString(),
    organizationId,
    actorId,
    displayName,
    locationIds,
    sessionExpiresAt,
    register,
    shift,
  };
}

/**
 * Rebuilds a presentation-only runtime view from the allowlisted snapshot.
 * `shiftOpen` stays false so a cached shift status cannot enable checkout.
 * Shift cash, device, and cashier fields are not read from storage.
 */
function presentAuthority(snapshot: StoredOfflineStaffPresentationV1): StaffRuntimeAuthority {
  const verifiedAtIso = new Date(Date.parse(snapshot.verifiedAt)).toISOString();
  const locationIds: string[] = [];
  for (const id of snapshot.locationIds) {
    locationIds.push(id);
  }
  const register: Register | null = snapshot.register
    ? {
        id: snapshot.register.id,
        name: snapshot.register.name,
        locationId: snapshot.register.locationId,
        currency: snapshot.register.currency,
        status: snapshot.register.status,
      }
    : null;
  const shift: Shift | null = snapshot.shift
    ? {
        id: snapshot.shift.id,
        registerId: snapshot.shift.registerId,
        deviceId: "",
        cashierId: snapshot.actorId,
        status: snapshot.shift.status,
        openingFloat: { minor: 0, currency: snapshot.register?.currency ?? "" },
        openedAt: snapshot.shift.openedAt,
      }
    : null;
  return {
    status: "ready",
    session: {
      actorId: snapshot.actorId,
      displayName: snapshot.displayName,
      organizationId: snapshot.organizationId,
      locationIds,
      capabilities: [],
      expiresAt: snapshot.sessionExpiresAt,
    },
    assignedLocationIds: locationIds,
    assignedRegisterIds: register ? [register.id] : [],
    assignedRegisters: register ? [register] : [],
    selectedRegisterId: register ? register.id : null,
    register,
    shift,
    shiftOpen: false,
    presentationOnly: true,
    lastVerifiedAt: verifiedAtIso,
    errorMessage: offlineVerifiedPresentationMessage(verifiedAtIso),
  };
}

function evaluateStored(value: unknown, now: Date): OfflinePresentationEvaluation {
  if (value == null) return { outcome: "absent" };
  const snapshot = parseStored(value);
  if (!snapshot) return { outcome: "invalid" };
  const verifiedAt = Date.parse(snapshot.verifiedAt);
  if (now.getTime() - verifiedAt > OFFLINE_STAFF_PRESENTATION_MAX_AGE_MS) {
    return { outcome: "grace_expired" };
  }
  return { outcome: "available", authority: presentAuthority(snapshot) };
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
      const snapshot = buildStoredOfflineStaffPresentation(authority, now);
      if (!snapshot) return;
      const storage = browserStorage();
      if (!storage) {
        fallback.write(authority, now);
        return;
      }
      try {
        storage.setItem(STORAGE_KEY, serializeStoredOfflineStaffPresentation(snapshot));
      } catch {
        fallback.write(authority, now);
      }
    },
    serializedSnapshot() {
      const storage = browserStorage();
      if (!storage) return fallback.serializedSnapshot();
      try {
        return storage.getItem(STORAGE_KEY);
      } catch {
        return fallback.serializedSnapshot();
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
  let stored: StoredOfflineStaffPresentationV1 | null = null;
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
      stored = buildStoredOfflineStaffPresentation(authority, now);
    },
    serializedSnapshot() {
      return stored ? serializeStoredOfflineStaffPresentation(stored) : null;
    },
    clear() {
      stored = null;
    },
  };
}
