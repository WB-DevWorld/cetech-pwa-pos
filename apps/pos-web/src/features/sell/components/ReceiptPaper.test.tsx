import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { mapReceiptSnapshot } from "../runtime/cashCheckoutController";
import { ReceiptPaper } from "./ReceiptPaper";

describe("ReceiptPaper", () => {
  test("renders frozen receipt presentation settings and cashier-friendly labels", () => {
    const view = mapReceiptSnapshot({
      id: "receipt-1",
      transactionId: "11111111-1111-4111-8111-111111111111",
      receiptNumber: "POS-1001",
      orderReference: "1001",
      issuedAt: "2026-09-23T10:15:00.000Z",
      locationName: "Accra Main Store",
      registerName: "Front Counter",
      cashierName: "Ama",
      customerLabel: "Walk-in",
      lines: [{
        name: "Very Long Original Product Name That Must Not Leak Into Frozen Receipt Presentation",
        displayName: "Very Long Original…",
        sku: "ABC-123",
        quantity: "1",
        unitPrice: { minor: 2500, currency: "GHS" },
        subtotal: { minor: 2500, currency: "GHS" },
        discount: { minor: 0, currency: "GHS" },
        tax: { minor: 0, currency: "GHS" },
        total: { minor: 2500, currency: "GHS" },
      }],
      subtotal: { minor: 2500, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
      total: { minor: 2500, currency: "GHS" },
      tender: "mobile_money",
      documentKind: "operational_pos_receipt",
    });
    const html = renderToStaticMarkup(<ReceiptPaper receipt={view} />);
    expect(html).toContain("Very Long Original…");
    expect(html).not.toContain("Very Long Original Product Name That Must Not Leak");
    expect(html).toContain("SKU ABC-123");
    expect(html).toContain("Mobile Money");
    expect(html).toContain("23 Sept 2026, 10:15");
    expect(html).not.toContain("mobile_money");
    expect(html).not.toContain("2026-09-23T10:15:00.000Z");
  });

  test("does not invent an SKU when the frozen receipt line has none", () => {
    const view = mapReceiptSnapshot({
      id: "receipt-2",
      transactionId: "22222222-2222-4222-8222-222222222222",
      receiptNumber: "POS-1002",
      orderReference: "1002",
      issuedAt: "2026-09-23T10:15:00.000Z",
      locationName: "Accra Main Store",
      registerName: "Front Counter",
      cashierName: "Ama",
      customerLabel: "Walk-in",
      lines: [{
        name: "Short name",
        displayName: "Short name",
        quantity: "1",
        unitPrice: { minor: 1000, currency: "GHS" },
        subtotal: { minor: 1000, currency: "GHS" },
        discount: { minor: 0, currency: "GHS" },
        tax: { minor: 0, currency: "GHS" },
        total: { minor: 1000, currency: "GHS" },
      }],
      subtotal: { minor: 1000, currency: "GHS" },
      discount: { minor: 0, currency: "GHS" },
      tax: { minor: 0, currency: "GHS" },
      total: { minor: 1000, currency: "GHS" },
      tender: "cash",
      documentKind: "operational_pos_receipt",
    });
    const html = renderToStaticMarkup(<ReceiptPaper receipt={view} />);
    expect(html).toContain(">Cash<");
    expect(html).not.toContain("SKU ");
  });
});
