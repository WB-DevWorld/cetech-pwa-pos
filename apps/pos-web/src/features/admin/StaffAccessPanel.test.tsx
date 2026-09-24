import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { StaffAccessRecord } from "../../server/admin/staff-access-directory";
import { StaffAccessPanel } from "./StaffAccessPanel";
import { TopologyPanel } from "./TopologyPanel";

function ownerRow(): StaffAccessRecord {
  return {
    actorId: "owner_a",
    displayName: "Ama Owner",
    email: "owner@example.com",
    authStatus: "active",
    posAccessStatus: "active",
    controlRole: "owner",
    locations: [],
  };
}

function panel(callerControlRole: "owner" | "admin") {
  return renderToStaticMarkup(
    <StaffAccessPanel
      rows={[ownerRow()]}
      canManage
      callerControlRole={callerControlRole}
      currentActorId="caller"
      onResetTemporaryPassword={() => undefined}
    />,
  );
}

describe("staff password reset visibility", () => {
  test("an admin does not get an owner password reset action", () => {
    const html = panel("admin");
    expect(html).toContain("An admin cannot reset an owner password.");
    expect(html).not.toContain("Reset temporary password");
  });

  test("an owner keeps the owner password reset action", () => {
    const html = panel("owner");
    expect(html).toContain("Reset temporary password");
    expect(html).not.toContain("An admin cannot reset an owner");
  });
});


describe("operational readiness presentation", () => {
  test("active register without an active device is not presented as ready to open", () => {
    const html = renderToStaticMarkup(
      <TopologyPanel
        mode="registers"
        rows={[
          {
            id: "loc_a2",
            name: "Location A2",
            status: "active",
            registers: [
              { id: "reg_b", name: "Register B", currency: "GHS", status: "active" },
            ],
            devices: [],
          },
        ]}
      />,
    );
    expect(html).toContain(
      "Cannot open a shift until this location has an active POS device.",
    );
  });

  test("inactive register cannot be newly selected for an existing staff assignment", () => {
    const row: StaffAccessRecord = {
      actorId: "cashier_a",
      displayName: "Cashier A",
      email: "cashier@example.com",
      authStatus: "active",
      posAccessStatus: "active",
      controlRole: null,
      locations: [
        { locationId: "loc_a1", role: "cashier", registerIds: ["reg_a"] },
      ],
    };
    const html = renderToStaticMarkup(
      <StaffAccessPanel
        rows={[row]}
        topology={[
          {
            id: "loc_a1",
            name: "Location A1",
            status: "active",
            registers: [
              { id: "reg_a", name: "Register A", currency: "GHS", status: "active" },
              {
                id: "reg_maintenance",
                name: "Maintenance Register",
                currency: "GHS",
                status: "maintenance",
              },
            ],
            devices: [],
          },
        ]}
        canManage
        callerControlRole="admin"
        currentActorId="admin_a"
        onSaveAssignment={() => undefined}
      />,
    );
    expect(html).toContain("Maintenance Register · Maintenance");
    expect(html).toMatch(
      /<input type="checkbox" disabled=""\/><span>Maintenance Register · Maintenance<\/span>/,
    );
  });
});
