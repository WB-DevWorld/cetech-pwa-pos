import { describe, expect, test } from "vitest";
import { composeStaffAssignmentDirectory } from "../../../apps/pos-web/src/server/sales/compose-assignment-directory";
import { createSupabaseStaffAssignmentDirectory } from "../../../apps/pos-web/src/server/auth/supabase-assignment-directory";
import type { PosRestFetch } from "../../../apps/pos-web/src/server/http/server-fetch";
import { createFakePosgrest } from "../sales/fake-posgrest";

function restFrom(
  handler: (input: string, init: Parameters<PosRestFetch>[1]) => Promise<{
    status: number;
    body?: unknown;
  }>,
): PosRestFetch {
  return async (input, init) => {
    const result = await handler(input, init);
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      json: async () => result.body ?? [],
    };
  };
}

describe("R6-REM-01 durable staff assignment directory", () => {
  test("ephemeral directory is refused for staging and production", () => {
    expect(() => composeStaffAssignmentDirectory({ APP_ENV: "staging" })).toThrow(
      /durable staff assignment directory is required/,
    );
    expect(() =>
      composeStaffAssignmentDirectory(
        { APP_ENV: "production", SUPABASE_URL: "https://example.supabase.co" },
        restFrom(async () => ({ status: 200 })),
      ),
    ).toThrow(/durable staff assignment directory is required/);
    expect(() => composeStaffAssignmentDirectory({ APP_ENV: "local" })).not.toThrow();
  });

  test("placeholders do not attach a durable directory", () => {
    const directory = composeStaffAssignmentDirectory({
      APP_ENV: "local",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "REPLACE_WITH_SERVER_ONLY_KEY",
    });
    expect(directory).toBeDefined();
  });

  test("correct actor and organization returns current location and register assignments", async () => {
    const fake = createFakePosgrest();
    fake.tables.pos_staff_location_assignments.push({
      actor_id: "cashier_a",
      organization_id: "org_a",
      location_id: "loc_a1",
      role: "cashier",
    });
    fake.tables.pos_staff_register_assignments.push({
      actor_id: "cashier_a",
      organization_id: "org_a",
      location_id: "loc_a1",
      register_id: "reg_a",
    });
    const directory = createSupabaseStaffAssignmentDirectory({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: fake.fetchImpl,
    });
    await expect(directory.lookup({ actorId: "cashier_a", organizationId: "org_a" })).resolves.toEqual({
      locationIds: ["loc_a1"],
      registerIds: ["reg_a"],
      locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
    });
  });

  test("wrong organization returns empty assignments rather than another tenant", async () => {
    const fake = createFakePosgrest();
    fake.tables.pos_staff_location_assignments.push({
      actor_id: "cashier_a",
      organization_id: "org_a",
      location_id: "loc_a1",
      role: "cashier",
    });
    const directory = createSupabaseStaffAssignmentDirectory({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: fake.fetchImpl,
    });
    await expect(directory.lookup({ actorId: "cashier_a", organizationId: "org_b" })).resolves.toEqual({
      locationIds: [],
      registerIds: [],
      locationRoles: [],
    });
  });

  test("actor with no locations or registers is fail-closed empty", async () => {
    const fake = createFakePosgrest();
    const directory = createSupabaseStaffAssignmentDirectory({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: fake.fetchImpl,
    });
    await expect(directory.lookup({ actorId: "cashier_a", organizationId: "org_a" })).resolves.toEqual({
      locationIds: [],
      registerIds: [],
      locationRoles: [],
    });
  });

  test("invalid roles and stale register rows outside assigned locations are ignored", async () => {
    const fake = createFakePosgrest();
    fake.tables.pos_staff_location_assignments.push(
      {
        actor_id: "cashier_a",
        organization_id: "org_a",
        location_id: "loc_a1",
        role: "admin",
      },
      {
        actor_id: "cashier_a",
        organization_id: "org_a",
        location_id: "loc_a1",
        role: "cashier",
      },
    );
    fake.tables.pos_staff_register_assignments.push(
      {
        actor_id: "cashier_a",
        organization_id: "org_a",
        location_id: "loc_a2",
        register_id: "reg_stale",
      },
      {
        actor_id: "cashier_a",
        organization_id: "org_a",
        location_id: "loc_a1",
        register_id: "reg_a",
      },
    );
    const directory = createSupabaseStaffAssignmentDirectory({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: fake.fetchImpl,
    });
    const result = await directory.lookup({ actorId: "cashier_a", organizationId: "org_a" });
    expect(result).not.toBe("unavailable");
    if (result === "unavailable") {
      throw new Error("expected assignments");
    }
    expect(result.locationRoles).toEqual([{ locationId: "loc_a1", role: "cashier" }]);
    expect(result.registerIds).toEqual(["reg_a"]);
  });

  test("network and least-privilege infrastructure failures are unavailable", async () => {
    const down = createSupabaseStaffAssignmentDirectory({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: createFakePosgrest({ unavailable: true }).fetchImpl,
    });
    await expect(down.lookup({ actorId: "cashier_a", organizationId: "org_a" })).resolves.toBe("unavailable");
    const denied = createSupabaseStaffAssignmentDirectory({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: createFakePosgrest({ deny: true }).fetchImpl,
    });
    await expect(denied.lookup({ actorId: "cashier_a", organizationId: "org_a" })).resolves.toBe("unavailable");
  });
});
