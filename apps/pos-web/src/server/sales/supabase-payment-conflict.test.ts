import { describe, expect, test } from "vitest";
import type { PosRestFetch } from "../http/server-fetch";
import type { StoredPayment } from "../../core/checkout/types";
import { createSupabaseCheckoutStore } from "./supabase-checkout-store";

const PAYMENT = "15151515-1515-4515-8515-151515151515";
const TX = "11111111-1111-4111-8111-111111111111";

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function pendingRow() {
  return {
    payment_id: PAYMENT,
    transaction_id: TX,
    sale_id: "sale-1",
    tender: "mobile_money",
    status: "awaiting_customer",
    amount_minor: 2900,
    amount_currency: "GHS",
    actor_id: "cashier_a",
    provider: "manual_mobile_money",
    provider_reference: "intent:15151515-1515-4515-8515-151515151515",
    manual_network: "MTN",
    merchant_account_label: "Shop till",
  };
}

function verifiedAttempt(): StoredPayment {
  return {
    paymentId: PAYMENT,
    transactionId: TX,
    saleId: "sale-1",
    tender: "mobile_money",
    status: "verified",
    amount: { minor: 2900, currency: "GHS" },
    actorId: "cashier_a",
    provider: "manual_mobile_money",
    providerReference: "MM-409",
    verificationSource: "approved_external_attestation",
    evidenceId: "16161616-1616-4616-8616-161616161616",
    verifiedAt: "2026-10-10T12:00:00.000Z",
    manualNetwork: "MTN",
    merchantAccountLabel: "Shop till",
    attestationActorId: "cashier_a",
  };
}

describe("PostgREST payment conflict", () => {
  test("a 409 while the stored row is still awaiting is not a verified replay", async () => {
    const fetchImpl: PosRestFetch = async (url, init) => {
      if (url.includes("pos_checkout_sales")) return response(200, []);
      if (init.method === "POST") return response(409, { code: "23505" });
      return response(200, [pendingRow()]);
    };
    const store = createSupabaseCheckoutStore({
      url: "http://127.0.0.1:54321",
      serviceRoleKey: "test-service-role",
      fetchImpl,
    });
    await expect(store.savePayment(verifiedAttempt())).rejects.toThrow(/rejected payment/);
  });

  test("a conditional confirm that conflicts does not return the pending row as verified", async () => {
    const fetchImpl: PosRestFetch = async (url, init) => {
      if (init.method === "PATCH") return response(409, { code: "23505" });
      return response(200, [pendingRow()]);
    };
    const store = createSupabaseCheckoutStore({
      url: "http://127.0.0.1:54321",
      serviceRoleKey: "test-service-role",
      fetchImpl,
    });
    const committed = await store.commitManualAttestation(verifiedAttempt());
    expect(committed.kind).toBe("conflict");
  });
});
