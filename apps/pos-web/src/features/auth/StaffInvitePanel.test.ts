import { describe, expect, test } from "vitest";
import { submitStaffInvite } from "./StaffInvitePanel";

describe("staff invite form", () => {
  test("posts only the email and does not send a redirect", async () => {
    let body = "";
    const result = await submitStaffInvite({
      email: "new.cashier@example.com",
      csrfToken: "csrf-1",
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      fetchImpl: async (_input, init) => {
        body = String(init?.body ?? "");
        return new Response(JSON.stringify({ ok: true, data: { invited: true } }), { status: 200 });
      },
    });
    expect(JSON.parse(body)).toEqual({ email: "new.cashier@example.com" });
    expect(body).not.toContain("redirect");
    expect(result.status).toBe("sent");
  });

  test("an unsigned invite is not described as an outage", async () => {
    const result = await submitStaffInvite({
      email: "new.cashier@example.com",
      csrfToken: "csrf-1",
      correlationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "AUTH_REQUIRED", message: "staff session is required" },
          }),
          { status: 401 },
        ),
    });
    expect(result.status).toBe("forbidden");
    expect(result.message).toBe("You don't have permission to invite staff.");
    expect(result.message).not.toContain("temporarily unavailable");
  });
});
