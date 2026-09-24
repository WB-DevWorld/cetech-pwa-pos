import { describe, expect, test } from "vitest";
import { createMemoryAssignmentDirectory } from "./assignments";
import { handleReadStaffSession } from "./handle-staff-session";
import { createEphemeralInMemoryStaffSessionStore } from "./session-store";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("staff session assignment refresh", () => {
  test("GET refreshes stale empty session scope from durable assignments", async () => {
    const store = createEphemeralInMemoryStaffSessionStore();
    const expiresAt = new Date("2099-01-01T00:00:00.000Z");
    const sessionId = await store.create(
      {
        actorId: "staff_a",
        displayName: "Staff A",
        organizationId: "org_a",
        locationIds: [],
        capabilities: [],
        expiresAt: expiresAt.toISOString(),
      },
      "csrf-token",
      expiresAt,
    );

    const result = await handleReadStaffSession({
      correlationIdHeader: CORRELATION,
      origin: null,
      referer: null,
      cookieHeader: `cetech_pos_sid=${sessionId}`,
      now: new Date("2026-09-23T17:00:00.000Z"),
      store,
      assignments: createMemoryAssignmentDirectory([
        {
          actorId: "staff_a",
          organizationId: "org_a",
          locationRoles: [{ locationId: "loc_a1", role: "cashier" }],
          registerIds: ["reg_a"],
        },
      ]),
      allowedOrigins: [],
    });

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    if (result.body.ok) {
      expect(result.body.data.session.locationIds).toEqual(["loc_a1"]);
      expect(result.body.data.assignedLocationIds).toEqual(["loc_a1"]);
      expect(result.body.data.assignedRegisterIds).toEqual(["reg_a"]);
    }
  });
});
