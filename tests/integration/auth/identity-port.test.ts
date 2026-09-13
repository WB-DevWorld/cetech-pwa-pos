import { describe, expect, test } from "vitest";
import { createStaffIdentityPort } from "../../../apps/pos-web/src/core/identity/staff-identity-port";
import { cashierClaims } from "./helpers";
import { toSession } from "../../../apps/pos-web/src/server/auth/claims";
import { CORRELATION } from "./helpers";

describe("CORE-02 IdentityPort", () => {
  test("getSession denies anonymous; can() is a UI hint only", async () => {
    let current: ReturnType<typeof toSession> | null = toSession(cashierClaims({ capabilities: ["ui.hint.only"] }));
    const port = createStaffIdentityPort({
      gateway: {
        async read() {
          return current;
        },
        async clear() {
          current = null;
        },
      },
      correlationId: () => CORRELATION,
    });

    const session = await port.getSession();
    expect(session.ok).toBe(true);
    expect(await port.can("ui.hint.only")).toBe(true);
    expect(await port.can("shift.close")).toBe(false);

    current = null;
    const missing = await port.getSession();
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.error.code).toBe("AUTH_REQUIRED");
    }
    expect(await port.can("ui.hint.only")).toBe(false);
  });

  test("sign-out does not clear IndexedDB drafts or operation journal", async () => {
    const localWork = {
      drafts: [{ cartId: "11111111-1111-4111-8111-111111111111" }],
      journal: [{ id: "22222222-2222-4222-8222-222222222222", status: "pending" }],
    };
    let session: ReturnType<typeof toSession> | null = toSession(cashierClaims());
    const port = createStaffIdentityPort({
      gateway: {
        async read() {
          return session;
        },
        async clear() {
          session = null;
        },
      },
      correlationId: () => CORRELATION,
      localWork,
    });

    await port.signOut();
    expect(session).toBeNull();
    expect(localWork.drafts).toHaveLength(1);
    expect(localWork.journal).toHaveLength(1);
    expect(localWork.journal[0]).toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      status: "pending",
    });
  });
});
