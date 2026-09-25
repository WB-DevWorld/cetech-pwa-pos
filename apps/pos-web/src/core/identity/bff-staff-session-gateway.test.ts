import { describe, expect, test } from "vitest";
import { createBffStaffSessionGateway } from "./bff-staff-session-gateway";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION = {
  actorId: "cashier_a",
  displayName: "Cashier A",
  organizationId: "org_a",
  locationIds: ["loc_a1"],
  capabilities: ["ui.hint.only"],
  expiresAt: "2099-01-01T00:00:00.000Z",
};

describe("BFF staff session gateway", () => {
  test("assignment lookup failure is not reported as an empty register list", async () => {
    const gateway = createBffStaffSessionGateway({
      correlationId: () => CORRELATION,
      fetchImpl: async (_input, init) => {
        if (init?.method === "POST") {
          return new Response(JSON.stringify({ ok: true, data: SESSION, correlationId: CORRELATION }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: "INTEGRATION_UNAVAILABLE",
              message: "staff assignment directory is unavailable",
              retryable: true,
              nextAction: "resolve",
              details: { field: "assignments" },
            },
            correlationId: CORRELATION,
          }),
          { status: 503 },
        );
      },
    });
    const result = await gateway.establish("access-token");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
      expect(result.error.details?.field).toBe("assignments");
    }
  });
});
