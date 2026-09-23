import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { StaffAccessRecord } from "../../server/admin/staff-access-directory";
import { StaffAccessPanel } from "./StaffAccessPanel";

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
