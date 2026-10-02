import { describe, expect, test } from "vitest";
import { createMemoryAssignmentDirectory } from "./assignments";
import { authorizeStaffRead } from "./authorize";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function identity(locationIds: readonly string[] = []) {
  return {
    ok: true as const,
    identity: {
      actorId: "staff_a",
      displayName: "Staff A",
      organizationId: "org_a",
      locationIds,
      registerId: null,
      capabilities: [],
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
  };
}

describe("durable staff assignment authority", () => {
  test("current durable assignments authorize a location even when Auth location metadata is empty", async () => {
    const result = await authorizeStaffRead({
      verifyResult: identity([]),
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "staff_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
          registerIds: ["reg_a"],
        },
      ]),
      correlationId: CORRELATION,
      required: {
        organizationId: "org_a",
        locationId: "loc_a1",
        registerId: "reg_a",
        permission: "shift.open",
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.session.locationIds).toEqual(["loc_a1"]);
      expect(result.data.assignmentRole).toBe("cashier");
    }
  });

  test("client scope still cannot escape durable assignments", async () => {
    const result = await authorizeStaffRead({
      verifyResult: identity(["loc_old"]),
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "staff_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
          registerIds: ["reg_a"],
        },
      ]),
      correlationId: CORRELATION,
      required: {
        organizationId: "org_a",
        locationId: "loc_a1",
        registerId: "reg_a",
      },
      client: {
        actorId: "staff_a",
        organizationId: "org_a",
        locationId: "loc_other",
        registerId: "reg_a",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });
});
