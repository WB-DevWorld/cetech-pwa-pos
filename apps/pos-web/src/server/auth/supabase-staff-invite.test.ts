import { describe, expect, test } from "vitest";
import { sendSupabaseStaffInvite } from "./supabase-staff-invite";

describe("supabase staff invite", () => {
  test("sends redirect_to on the admin invite and does not follow a caller URL", async () => {
    let requested = "";
    let body = "";
    const result = await sendSupabaseStaffInvite({
      supabaseUrl: "https://project.supabase.co",
      serviceRoleKey: "service-role-test-key",
      email: "new.cashier@example.com",
      redirectTo: "https://pos-staging.example.com/auth/invite",
      fetchImpl: async (input, init) => {
        requested = String(input);
        body = String(init?.body ?? "");
        return new Response("{}", { status: 200 });
      },
    });
    const url = new URL(requested);
    expect(result).toEqual({ ok: true });
    expect(url.origin).toBe("https://project.supabase.co");
    expect(url.pathname).toBe("/auth/v1/invite");
    expect(url.searchParams.get("redirect_to")).toBe("https://pos-staging.example.com/auth/invite");
    expect(url.searchParams.get("redirect_to")).not.toContain("localhost");
    expect(url.searchParams.get("redirect_to")).not.toContain("vercel.app");
    expect(body).toBe(JSON.stringify({ email: "new.cashier@example.com" }));
    expect(body).not.toContain("attacker.example");
  });

  test("classifies an existing account without treating it as sent", async () => {
    const result = await sendSupabaseStaffInvite({
      supabaseUrl: "https://project.supabase.co",
      serviceRoleKey: "service-role-test-key",
      email: "existing@example.com",
      redirectTo: "https://pos-staging.example.com/auth/invite",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error_code: "email_exists", msg: "already been registered" }), {
          status: 422,
        }),
    });
    expect(result).toEqual({ ok: false, reason: "already_registered" });
  });
});
