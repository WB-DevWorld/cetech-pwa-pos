export type SelectedRegisterStore = {
  read(organizationId: string, actorId: string): string | null;
  write(organizationId: string, actorId: string, registerId: string): void;
  clear(organizationId: string, actorId: string): void;
};

export function selectedRegisterStorageKey(organizationId: string, actorId: string): string {
  return `cetech-pos:selected-register:${organizationId}:${actorId}`;
}

export function createMemorySelectedRegisterStore(
  initial: Readonly<Record<string, string>> = {},
): SelectedRegisterStore {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    read(organizationId, actorId) {
      return map.get(selectedRegisterStorageKey(organizationId, actorId)) ?? null;
    },
    write(organizationId, actorId, registerId) {
      map.set(selectedRegisterStorageKey(organizationId, actorId), registerId);
    },
    clear(organizationId, actorId) {
      map.delete(selectedRegisterStorageKey(organizationId, actorId));
    },
  };
}

function browserStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return null;
    }
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Browser/device-local preference. Server assignedRegisterIds remain authorization. */
export function createLocalSelectedRegisterStore(): SelectedRegisterStore {
  const fallback = createMemorySelectedRegisterStore();
  return {
    read(organizationId, actorId) {
      const key = selectedRegisterStorageKey(organizationId, actorId);
      const storage = browserStorage();
      if (!storage) {
        return fallback.read(organizationId, actorId);
      }
      try {
        const value = storage.getItem(key);
        return value && value.length > 0 ? value : null;
      } catch {
        return fallback.read(organizationId, actorId);
      }
    },
    write(organizationId, actorId, registerId) {
      const key = selectedRegisterStorageKey(organizationId, actorId);
      const storage = browserStorage();
      if (!storage) {
        fallback.write(organizationId, actorId, registerId);
        return;
      }
      try {
        storage.setItem(key, registerId);
      } catch {
        fallback.write(organizationId, actorId, registerId);
      }
    },
    clear(organizationId, actorId) {
      const key = selectedRegisterStorageKey(organizationId, actorId);
      const storage = browserStorage();
      if (!storage) {
        fallback.clear(organizationId, actorId);
        return;
      }
      try {
        storage.removeItem(key);
      } catch {
        fallback.clear(organizationId, actorId);
      }
    },
  };
}

export type SelectedRegisterDecision = {
  readonly selectedRegisterId: string | null;
  /** Persistence to apply only after the caller proves this resolution is still current. */
  readonly persist: "keep" | "clear" | "write";
};

/** Pure assignment-list decision. Does not read or write the preference store. */
export function decideSelectedRegisterId(input: {
  readonly assignedRegisterIds: readonly string[];
  readonly storedRegisterId: string | null;
}): SelectedRegisterDecision {
  const assigned = input.assignedRegisterIds;
  const stored = input.storedRegisterId;
  if (stored && assigned.includes(stored)) {
    return { selectedRegisterId: stored, persist: "keep" };
  }
  if (assigned.length === 1) {
    return { selectedRegisterId: assigned[0]!, persist: "write" };
  }
  return { selectedRegisterId: null, persist: stored ? "clear" : "keep" };
}

export function resolveSelectedRegisterId(input: {
  readonly assignedRegisterIds: readonly string[];
  readonly organizationId: string;
  readonly actorId: string;
  readonly store: SelectedRegisterStore;
}): string | null {
  const decision = decideSelectedRegisterId({
    assignedRegisterIds: input.assignedRegisterIds,
    storedRegisterId: input.store.read(input.organizationId, input.actorId),
  });
  if (decision.persist === "clear") {
    input.store.clear(input.organizationId, input.actorId);
  } else if (decision.persist === "write" && decision.selectedRegisterId) {
    input.store.write(input.organizationId, input.actorId, decision.selectedRegisterId);
  }
  return decision.selectedRegisterId;
}
