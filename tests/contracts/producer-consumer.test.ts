import { describe, expect, test } from "vitest";
import fixtures from "./fixtures.json";
import domainSchema from "../../docs/contracts/pos-domain.schema.json";
import { validateCanonicalDef } from "../../apps/pos-web/src/server/quotes/canonical-schema";

type Fixture = {
  readonly name: string;
  readonly schema: string;
  readonly valid: boolean;
  readonly value: unknown;
};

const RETAIL_FP = "0123456789abcdef0123456789abcdef";
const TX = "11111111-1111-4111-8111-111111111111";
const PAYMENT = "22222222-2222-4222-8222-222222222222";

const money = { minor: 1500, currency: "GHS" };

describe("CORE-06 producer-consumer schema harness", () => {
  test("frozen schema still rejects extra PrepareSaleRequest fields", () => {
    expect(domainSchema.$defs.PrepareSaleRequest.additionalProperties).toBe(false);
    expect(domainSchema.$defs.PreparedSale.additionalProperties).toBe(false);
    expect(domainSchema.$defs.CashPaymentRequest.additionalProperties).toBe(false);
    expect(domainSchema.$defs.FinalizeSaleRequest.additionalProperties).toBe(false);
    expect(domainSchema.$defs.ReceiptSnapshot.additionalProperties).toBe(false);
  });

  test.each(fixtures as Fixture[])("control-plane fixture: $name", (fixture) => {
    expect(validateCanonicalDef(fixture.schema, fixture.value)).toBe(fixture.valid);
  });

  test("cash-sale producer envelopes are accepted and extra fields are rejected", () => {
    const prepareRequest = {
      transactionId: TX,
      registerId: "reg_a1",
      shiftId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      deviceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      quoteId: "quote-retail-1",
      quoteFingerprint: RETAIL_FP,
    };
    expect(validateCanonicalDef("PrepareSaleRequest", prepareRequest)).toBe(true);
    expect(validateCanonicalDef("PrepareSaleRequest", { ...prepareRequest, total: money })).toBe(false);

    const prepared = {
      transactionId: TX,
      saleId: "woo-1",
      orderReference: "woo-1",
      quoteFingerprint: RETAIL_FP,
      total: money,
      status: "prepared",
      stockCommitment: "reserved",
      preparedAt: "2026-09-15T12:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
    };
    expect(validateCanonicalDef("PreparedSale", prepared)).toBe(true);
    expect(validateCanonicalDef("PreparedSale", { ...prepared, unitPrice: money })).toBe(false);

    const cash = { transactionId: TX, cashReceived: { minor: 2000, currency: "GHS" } };
    expect(validateCanonicalDef("CashPaymentRequest", cash)).toBe(true);
    expect(validateCanonicalDef("CashPaymentRequest", { ...cash, customerId: "cust-1" })).toBe(false);

    const payment = {
      transactionId: TX,
      paymentId: PAYMENT,
      tender: "cash",
      status: "verified",
      amount: money,
      verifiedAt: "2026-09-15T12:01:00.000Z",
      nextAction: "none",
    };
    expect(validateCanonicalDef("PaymentState", payment)).toBe(true);

    const lookup = { transactionId: TX, paymentId: PAYMENT };
    expect(validateCanonicalDef("PaymentLookup", lookup)).toBe(true);

    const finalize = { transactionId: TX, paymentId: PAYMENT };
    expect(validateCanonicalDef("FinalizeSaleRequest", finalize)).toBe(true);

    const resolution = {
      transactionId: TX,
      status: "completed",
      saleId: "woo-1",
      orderReference: "woo-1",
      receiptId: "rcpt-11111111",
      paymentId: PAYMENT,
    };
    expect(validateCanonicalDef("SaleResolution", resolution)).toBe(true);

    const receipt = {
      id: "rcpt-11111111",
      transactionId: TX,
      receiptNumber: "POS-woo-1",
      orderReference: "woo-1",
      issuedAt: "2026-09-15T12:02:00.000Z",
      locationName: "loc_a1",
      registerName: "Register 1",
      cashierName: "Cashier A",
      customerLabel: "Walk-in",
      lines: [
        {
          name: "p-hardener",
          quantity: "1",
          unitPrice: money,
          subtotal: money,
          discount: { minor: 0, currency: "GHS" },
          tax: { minor: 0, currency: "GHS" },
          total: money,
        },
      ],
      subtotal: money,
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
      total: money,
      tender: "cash",
      cashReceived: { minor: 2000, currency: "GHS" },
      changeDue: { minor: 500, currency: "GHS" },
      documentKind: "operational_pos_receipt",
    };
    expect(validateCanonicalDef("ReceiptSnapshot", receipt)).toBe(true);
    expect(validateCanonicalDef("ReceiptSnapshot", { ...receipt, reprintOf: receipt.id })).toBe(false);
  });
});
