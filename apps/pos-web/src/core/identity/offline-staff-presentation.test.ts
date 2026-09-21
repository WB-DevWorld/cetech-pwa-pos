import { describe, expect, test } from "vitest";
import type { Register, Session, Shift } from "../../../../../docs/contracts/domain.generated";
import type { StaffRuntimeAuthority } from "./staff-runtime";
import {
  createMemoryOfflineStaffPresentationStore,
  OFFLINE_STAFF_PRESENTATION_MAX_AGE_MS,
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

  test("expires the local presentation by age and by server session expiry", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    const verifiedAt = new Date("2026-09-21T10:00:00.000Z");
    store.write(authority(), verifiedAt);

    expect(
      store.read(new Date(verifiedAt.getTime() + OFFLINE_STAFF_PRESENTATION_MAX_AGE_MS + 1)),
    ).toBeNull();
    expect(store.read(new Date("2026-09-22T12:00:00.001Z"))).toBeNull();
  });

  test("explicit clear removes offline presentation", () => {
    const store = createMemoryOfflineStaffPresentationStore();
    store.write(authority(), new Date("2026-09-21T10:00:00.000Z"));
    store.clear();
    expect(store.read(new Date("2026-09-21T10:01:00.000Z"))).toBeNull();
  });
});
