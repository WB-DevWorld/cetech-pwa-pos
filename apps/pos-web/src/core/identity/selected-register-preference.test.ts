import { describe, expect, test } from "vitest";
import {
  createMemorySelectedRegisterStore,
  decideSelectedRegisterId,
  resolveSelectedRegisterId,
  selectedRegisterStorageKey,
} from "./selected-register-preference";

describe("selected register preference", () => {
  test("scopes the storage key by organization and actor", () => {
    expect(selectedRegisterStorageKey("org_a", "cashier_a")).toBe("cetech-pos:selected-register:org_a:cashier_a");
  });

  test("one assignment auto-selects that register when nothing valid is stored", () => {
    const store = createMemorySelectedRegisterStore();
    expect(
      resolveSelectedRegisterId({
        assignedRegisterIds: ["reg_a"],
        organizationId: "org_a",
        actorId: "cashier_a",
        store,
      }),
    ).toBe("reg_a");
    expect(store.read("org_a", "cashier_a")).toBe("reg_a");
  });

  test("two assignments with no stored choice do not auto-select the first", () => {
    const store = createMemorySelectedRegisterStore();
    expect(
      resolveSelectedRegisterId({
        assignedRegisterIds: ["reg_a", "reg_b"],
        organizationId: "org_a",
        actorId: "cashier_a",
        store,
      }),
    ).toBeNull();
    expect(store.read("org_a", "cashier_a")).toBeNull();
  });

  test("restores a stored selection that is still assigned", () => {
    const store = createMemorySelectedRegisterStore({
      [selectedRegisterStorageKey("org_a", "cashier_a")]: "reg_b",
    });
    expect(
      resolveSelectedRegisterId({
        assignedRegisterIds: ["reg_a", "reg_b"],
        organizationId: "org_a",
        actorId: "cashier_a",
        store,
      }),
    ).toBe("reg_b");
  });

  test("clears a stored register that is no longer assigned", () => {
    const store = createMemorySelectedRegisterStore({
      [selectedRegisterStorageKey("org_a", "cashier_a")]: "reg_b",
    });
    expect(
      resolveSelectedRegisterId({
        assignedRegisterIds: ["reg_a"],
        organizationId: "org_a",
        actorId: "cashier_a",
        store,
      }),
    ).toBe("reg_a");
    expect(store.read("org_a", "cashier_a")).toBe("reg_a");
  });

  test("assignment decision is pure until the caller applies it", () => {
    expect(decideSelectedRegisterId({
      assignedRegisterIds: ["reg_a"],
      storedRegisterId: "reg_b",
    })).toEqual({ selectedRegisterId: "reg_a", persist: "write" });
    expect(decideSelectedRegisterId({
      assignedRegisterIds: ["reg_a", "reg_c"],
      storedRegisterId: "reg_b",
    })).toEqual({ selectedRegisterId: null, persist: "clear" });
    expect(decideSelectedRegisterId({
      assignedRegisterIds: ["reg_a", "reg_b"],
      storedRegisterId: "reg_b",
    })).toEqual({ selectedRegisterId: "reg_b", persist: "keep" });
    expect(decideSelectedRegisterId({
      assignedRegisterIds: ["reg_a", "reg_b"],
      storedRegisterId: null,
    })).toEqual({ selectedRegisterId: null, persist: "keep" });
  });
});
