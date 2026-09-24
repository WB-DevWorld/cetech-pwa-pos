import { describe, expect, test } from "vitest";
import { createBffStaffSessionGateway } from "./bff-staff-session-gateway";

const CORRELATION = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const session = {
  actorId: "cashier_a",
  displayName: "Cashier A",
  organizationId: "org_a",
  locationIds: ["loc_a1"],
  capabilities: [],
  expiresAt: "2099-01-01T00:00:00.000Z",
};

describe("BFF staff session establishment", () => {
  test("does not treat POST session data as register authority when GET fails", async () => {
    const methods: string[] = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      if (init?.method === "POST") {
        return new Response(
          JSON.stringify({ ok: true, data: session, correlationId: CORRELATION }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: "INTEGRATION_UNAVAILABLE",
            message: "staff assignment directory is unavailable",
            retryable: true,
            nextAction: "resolve",
          },
          correlationId: CORRELATION,
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    const gateway = createBffStaffSessionGateway({
      fetchImpl,
      correlationId: () => CORRELATION,
    });

    const result = await gateway.establish("synthetic-access-token");

    expect(methods).toEqual(["POST", "GET"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTEGRATION_UNAVAILABLE");
    }
  });
});
