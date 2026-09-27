import { describe, expect, test } from "vitest";
import type { Register, Session, Shift } from "../../../../../docs/contracts/domain.generated";
import { checkoutScopeFromStaffAuthority } from "./checkout-scope";
import type { StaffRuntimeAuthority } from "./staff-runtime";
import {
  createLocalOfflineStaffPresentationStore,
  createMemoryOfflineStaffPresentationStore,
  offlinePresentationBanner,
  OFFLINE_STAFF_PRESENTATION_MAX_AGE_MS,
  OFFLINE_STAFF_PRESENTATION_STORAGE_KEY,
  STORED_OFFLINE_REGISTER_PRESENTATION_KEYS,
  STORED_OFFLINE_SHIFT_PRESENTATION_KEYS,
  STORED_OFFLINE_STAFF_PRESENTATION_KEYS,
} from "./offline-staff-presentation";

const SESSION: Session = {
  actorId: "cashier-a",
  displayName: "Cashier A",
  organizationId: "org-a",
  locationIds: ["loc-a"],
  capabilities: [],
  expiresAt: "2026-09-22T12:00:00.000Z",
};
const REGISTER: Register = {
  id: "reg-a",
  name: "Register A",
  locationId: "loc-a",
  currency: "GHS",
  status: "active",
};
const SHIFT: Shift = {
  id: "11111111-1111-4111-8111-111111111111",
  registerId: "reg-a",
  deviceId: "22222222-2222-4222-8222-222222222222",
  cashierId: "cashier-a",
  status: "open",
  openingFloat: { minor: 0, currency: "GHS" },
  openedAt: "2026-09-21T08:00:00.000Z",
};

function authority(): StaffRuntimeAuthority {
  return {
    status: "ready",
    session: SESSION,
    assignedLocationIds: ["loc-a"],
    assignedRegisterIds: ["reg-a"],
    assignedRegisters: [REGISTER],
    selectedRegisterId: "reg-a",
    register: REGISTER,
    shift: SHIFT,
    shiftOpen: true,
  };
}

describe("offline staff presentation cache", () => {
  test("restores a bounded presentation-only snapshot without converting it into authority", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    const verifiedAt = new Date("2026-09-21T10:00:00.000Z");
    store.write(authority(), verifiedAt);

    const restored = store.read(new Date("2026-09-21T11:00:00.000Z"));
    expect(restored).toMatchObject({
      status: "ready",
      session: { actorId: "cashier-a" },
      register: { id: "reg-a" },
      shift: { id: SHIFT.id },
      presentationOnly: true,
    });
    expect(restored?.errorMessage).toContain("Offline");
  });

  test("expires the local presentation when the 24-hour grace has elapsed", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    const verifiedAt = new Date("2026-09-21T10:00:00.000Z");
    store.write(authority(), verifiedAt);

    expect(
      store.read(new Date(verifiedAt.getTime() + OFFLINE_STAFF_PRESENTATION_MAX_AGE_MS + 1)),
    ).toBeNull();
    expect(store.read(new Date("2026-09-22T12:00:00.001Z"))).toBeNull();
  });

  test("online session expiry inside the 24-hour grace still restores presentation", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    const verifiedAt = new Date("2026-09-21T10:00:00.000Z");
    store.write(
      {
        ...authority(),
        session: { ...SESSION, expiresAt: "2026-09-21T12:00:00.000Z" },
      },
      verifiedAt,
    );

    const restored = store.read(new Date("2026-09-21T13:00:00.000Z"));
    expect(restored?.presentationOnly).toBe(true);
    expect(restored?.session?.actorId).toBe("cashier-a");
    expect(restored?.session?.organizationId).toBe("org-a");
    expect(restored?.lastVerifiedAt).toBe("2026-09-21T10:00:00.000Z");
    expect(restored?.errorMessage).toContain("Offline — staff access last verified at");
    expect(restored?.errorMessage).toContain("2026-09-21 10:00:00 UTC");
    expect(restored?.errorMessage).not.toContain("Signed in");
    expect(restored?.session?.capabilities).toEqual([]);
  });

  test("retires an elapsed grace snapshot so a backward clock cannot revive it", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    const verifiedAt = new Date("2026-09-21T10:00:00.000Z");
    store.write(authority(), verifiedAt);
    const expired = new Date(verifiedAt.getTime() + OFFLINE_STAFF_PRESENTATION_MAX_AGE_MS + 1);
    expect(store.evaluate(expired).outcome).toBe("grace_expired");
    expect(store.read(new Date(verifiedAt.getTime() + 60_000))).toBeNull();
  });

  test("a later verified cashier replaces the previous snapshot", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    store.write(authority(), new Date("2026-09-21T10:00:00.000Z"));
    store.write(
      {
        ...authority(),
        session: { ...SESSION, actorId: "cashier-b", displayName: "Cashier B" },
      },
      new Date("2026-09-21T11:00:00.000Z"),
    );
    const restored = store.read(new Date("2026-09-21T11:30:00.000Z"));
    expect(restored?.session?.actorId).toBe("cashier-b");
    expect(restored?.session?.displayName).toBe("Cashier B");
  });

  test("refuses a snapshot with no organization", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    store.write(
      {
        ...authority(),
        session: { ...SESSION, organizationId: "  " },
      },
      new Date("2026-09-21T10:00:00.000Z"),
    );
    expect(store.evaluate(new Date("2026-09-21T10:01:00.000Z")).outcome).toBe("absent");
  });

  test("strips stored capabilities so the snapshot cannot carry management authority", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    store.write(
      {
        ...authority(),
        session: { ...SESSION, capabilities: ["pos.admin", "owner"] },
      },
      new Date("2026-09-21T10:00:00.000Z"),
    );
    expect(store.read(new Date("2026-09-21T10:30:00.000Z"))?.session?.capabilities).toEqual([]);
  });

  test("persists only allowlisted presentation fields and ignores future authority fields", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    const verifiedAt = new Date("2026-09-21T10:00:00.000Z");
    const live = {
      ...authority(),
      futureSensitiveAuthority: "must-not-persist",
      errorMessage: "auth-error-must-not-persist",
      presentationOnly: false,
      session: {
        ...SESSION,
        capabilities: ["pos.admin", "owner"],
        accessToken: "token-must-not-persist",
      },
      register: {
        ...REGISTER,
        providerSecret: "secret-must-not-persist",
      },
      shift: {
        ...SHIFT,
        openingFloat: { minor: 9900, currency: "GHS" },
        expectedCash: { minor: 8800, currency: "GHS" },
        countedCash: { minor: 7700, currency: "GHS" },
        deviceId: "device-must-not-persist",
        cashierId: "other-cashier",
        zReportId: "z-report-must-not-persist",
      },
    };
    store.write(live as StaffRuntimeAuthority, verifiedAt);

    const json = store.serializedSnapshot();
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json ?? "{}") as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual([...STORED_OFFLINE_STAFF_PRESENTATION_KEYS].sort());
    expect(Object.keys(parsed.register as object).sort()).toEqual([...STORED_OFFLINE_REGISTER_PRESENTATION_KEYS].sort());
    expect(Object.keys(parsed.shift as object).sort()).toEqual([...STORED_OFFLINE_SHIFT_PRESENTATION_KEYS].sort());
    expect(json).not.toContain("must-not-persist");
    expect(json).not.toContain("futureSensitiveAuthority");
    expect(json).not.toContain("capabilities");
    expect(json).not.toContain("errorMessage");
    expect(json).not.toContain("presentationOnly");
    expect(json).not.toContain("openingFloat");
    expect(json).not.toContain("expectedCash");
    expect(json).not.toContain("countedCash");
    expect(json).not.toContain("deviceId");
    expect(json).not.toContain("cashierId");
    expect(json).not.toContain("accessToken");
    expect(json).not.toContain("pos.admin");
    expect(json).not.toContain("9900");

    const restored = store.read(new Date("2026-09-21T11:00:00.000Z"));
    expect(restored?.presentationOnly).toBe(true);
    expect(restored?.session?.capabilities).toEqual([]);
    expect(restored?.shiftOpen).toBe(false);
    expect(restored && "futureSensitiveAuthority" in restored).toBe(false);
    expect(checkoutScopeFromStaffAuthority(restored ?? authority())).toBeUndefined();
  });

  test("reconstruction ignores extra fields added to a stored snapshot", () => {
    const bucket = new Map<string, string>();
    const previousWindow = (globalThis as { window?: unknown }).window;
    Object.assign(globalThis, {
      window: {
        localStorage: {
          getItem: (key: string) => bucket.get(key) ?? null,
          setItem: (key: string, value: string) => {
            bucket.set(key, value);
          },
          removeItem: (key: string) => {
            bucket.delete(key);
          },
        },
      },
    });
    try {
      const store = createLocalOfflineStaffPresentationStore();
      store.write(authority(), new Date("2026-09-21T10:00:00.000Z"));
      const raw = bucket.get(OFFLINE_STAFF_PRESENTATION_STORAGE_KEY);
      const parsed = JSON.parse(raw ?? "{}") as Record<string, unknown>;
      parsed.futureSensitiveAuthority = "must-not-persist";
      parsed.authority = { capabilities: ["pos.admin"], presentationOnly: false };
      const register = parsed.register as Record<string, unknown>;
      register.openingFloat = { minor: 9900, currency: "GHS" };
      bucket.set(OFFLINE_STAFF_PRESENTATION_STORAGE_KEY, JSON.stringify(parsed));

      const restored = store.read(new Date("2026-09-21T11:00:00.000Z"));
      expect(restored?.presentationOnly).toBe(true);
      expect(restored?.session?.capabilities).toEqual([]);
      expect(restored?.session?.actorId).toBe("cashier-a");
      expect(restored && "futureSensitiveAuthority" in restored).toBe(false);
      expect(restored?.shift?.openingFloat).toEqual({ minor: 0, currency: "GHS" });
      expect(checkoutScopeFromStaffAuthority(restored ?? authority())).toBeUndefined();
    } finally {
      if (previousWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = previousWindow;
      }
    }
  });

  test("offline banner names the last verification and does not claim a current sign-in", () => {
    const banner = offlinePresentationBanner({
      online: false,
      lastVerifiedAt: "2026-09-21T10:00:00.000Z",
    });
    expect(banner.title).toBe("Offline — staff access last verified at 2026-09-21 10:00:00 UTC.");
    expect(banner.detail).toContain("Payments, authoritative pricing, returns and register changes stay unavailable");
    expect(`${banner.title} ${banner.detail}`).not.toContain("Signed in");
  });

  test("explicit clear removes offline presentation", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    store.write(authority(), new Date("2026-09-21T10:00:00.000Z"));
    store.clear();
    expect(store.read(new Date("2026-09-21T10:01:00.000Z"))).toBeNull();
  });
});
