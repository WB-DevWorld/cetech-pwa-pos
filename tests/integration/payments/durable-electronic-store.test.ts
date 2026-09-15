import { describe, expect, test } from "vitest";
import { createSupabaseCheckoutStore } from "../../../apps/pos-web/src/server/sales/supabase-checkout-store";
import { createFakePosgrest } from "../sales/fake-posgrest";

const TX = "11111111-1111-4111-8111-111111111301";
const PAYMENT_ID = "22222222-2222-4222-8222-222222222301";
const SHIFT_ID = "55555555-5555-4555-8555-555555555301";
const DEVICE_ID = "00000000-0000-4000-8000-0000000000a1";

describe("PAY-01 durable electronic payment store", () => {
  test("provider reference and webhook events survive a new store instance", async () => {
    const fake = createFakePosgrest();
    const first = createSupabaseCheckoutStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: fake.fetchImpl,
    });
    await first.seedRegister({
      id: "reg_a",
      name: "Register A",
      locationId: "loc_a1",
      currency: "GHS",
      status: "active",
      organizationId: "org_a",
    });
    await first.seedDevice({
      id: DEVICE_ID,
      organizationId: "org_a",
      locationId: "loc_a1",
      status: "active",
    });
    expect(
      await first.insertOpenShift({
        id: SHIFT_ID,
        registerId: "reg_a",
        deviceId: DEVICE_ID,
        cashierId: "cashier_a",
        status: "open",
        openingFloat: { minor: 5000, currency: "GHS" },
        openedAt: "2026-09-15T12:00:00.000Z",
        organizationId: "org_a",
        locationId: "loc_a1",
      }),
    ).toBe("ok");
    await first.seedPreparedSale({
      organizationId: "org_a",
      locationId: "loc_a1",
      locationName: "Location A1",
      registerId: "reg_a",
      registerName: "Register A",
      deviceId: DEVICE_ID,
      shiftId: SHIFT_ID,
      cashierId: "cashier_a",
      cashierName: "Cashier A",
      customer: { kind: "walkin" },
      customerLabel: "Walk-in",
      prepared: {
        transactionId: TX,
        saleId: "woo-pay01",
        orderReference: "woo-pay01",
        quoteFingerprint: "0123456789abcdef0123456789abcdef",
        total: { minor: 2900, currency: "GHS" },
        status: "prepared",
        stockCommitment: "reserved",
        preparedAt: "2026-09-15T12:00:00.000Z",
        expiresAt: "2026-09-15T18:00:00.000Z",
      },
      lines: [],
      subtotal: { minor: 2900, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
    });
    await first.savePayment({
      paymentId: PAYMENT_ID,
      transactionId: TX,
      saleId: "woo-pay01",
      tender: "card",
      status: "awaiting_customer",
      amount: { minor: 2900, currency: "GHS" },
      actorId: "cashier_a",
      provider: "paystack",
      providerReference: "pos_pay01durable",
      initializeStatus: "initialized",
    });
    expect(await first.saveProviderEvent({
      id: "44444444-4444-4444-8444-444444444301",
      organizationId: "org_a",
      locationId: "loc_a1",
      provider: "paystack",
      providerReference: "pos_pay01durable",
      eventType: "charge.success",
      eventFingerprint: "fp-durable-1",
      rawBodyHash: "ab",
      receivedAt: "2026-09-15T12:01:00.000Z",
      processingStatus: "ingested",
      paymentId: PAYMENT_ID,
      transactionId: TX,
    })).toBe("inserted");
    expect(await first.saveProviderEvent({
      id: "44444444-4444-4444-8444-444444444302",
      provider: "paystack",
      eventType: "charge.success",
      eventFingerprint: "fp-durable-1",
      rawBodyHash: "ab",
      receivedAt: "2026-09-15T12:01:01.000Z",
      processingStatus: "ingested",
    })).toBe("duplicate");

    const restarted = createSupabaseCheckoutStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "server-only-infrastructure",
      fetchImpl: fake.fetchImpl,
    });
    await expect(restarted.getPaymentByProviderReference("paystack", "pos_pay01durable")).resolves.toMatchObject({
      paymentId: PAYMENT_ID,
      tender: "card",
      status: "awaiting_customer",
      providerReference: "pos_pay01durable",
    });
    await expect(restarted.getProviderEvent("paystack", "fp-durable-1")).resolves.toMatchObject({
      processingStatus: "ingested",
      paymentId: PAYMENT_ID,
    });
  });
});
