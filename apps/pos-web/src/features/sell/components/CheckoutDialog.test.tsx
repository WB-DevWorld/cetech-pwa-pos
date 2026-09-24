import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CheckoutDialog } from "./CheckoutDialog";
import { idleCheckoutSession, type CheckoutSessionView } from "../state/checkoutSession";

const noop = () => undefined;

function render(session: CheckoutSessionView, inFlight = false) {
  return renderToStaticMarkup(
    createElement(CheckoutDialog, {
      session,
      inFlight,
      onConfirmCash: noop,
      onResolveSale: noop,
      onResolvePayment: noop,
      onRetryFinalize: noop,
      onRetryReceipt: noop,
      onPrint: noop,
      onNewSale: noop,
      onDismiss: noop,
    }),
  );
}

describe("CheckoutDialog stages", () => {
  test("preparing, cash, confirming cash, and finalizing are distinct and hide receipt paper", () => {
    expect(render({ ...idleCheckoutSession(), stage: "preparing", message: "Preparing order." })).toContain(
      'data-checkout-stage="preparing"',
    );
    const cash = render({
      ...idleCheckoutSession(),
      stage: "cash",
      prepared: {
        transactionId: "tx",
        saleId: "sale",
        orderReference: "POS-1",
        quoteFingerprint: "fp",
        total: { minor: 1500, currency: "GHS" },
      },
    });
    expect(cash).toContain('data-checkout-stage="cash"');
    expect(cash).toContain("Confirm cash");
    expect(cash).toContain("Back");
    expect(cash).toContain("Change due");
    expect(cash).toContain('data-checkout-dismissable="false"');
    expect(cash).not.toContain("Keep cart");
    expect(cash).not.toContain("receipt-paper");
    const confirming = render({ ...idleCheckoutSession(), stage: "confirming_cash", message: "Confirming cash payment." });
    expect(confirming).toContain('data-checkout-stage="confirming_cash"');
    expect(confirming).toContain("Confirming cash");
    expect(confirming).not.toContain("receipt-paper");
    const finalizing = render({ ...idleCheckoutSession(), stage: "finalizing", message: "Finalizing the sale." });
    expect(finalizing).toContain('data-checkout-stage="finalizing"');
    expect(finalizing).toContain("Completing sale…");
    expect(finalizing).not.toContain("receipt-paper");
    expect(finalizing).not.toContain("Confirm cash");
  });

  test("receipt paper is shown only from a ReceiptPort snapshot after completion", () => {
    const complete = render({
      ...idleCheckoutSession(),
      stage: "complete",
      saleCompleted: true,
      message: "The sale is complete. Loading the official receipt.",
    });
    expect(complete).not.toContain("receipt-paper");
    const ready = render({
      ...idleCheckoutSession(),
      stage: "receipt_ready",
      saleCompleted: true,
      receipt: {
        id: "receipt-port-1",
        transactionId: "tx",
        receiptNumber: "R-PORT-99",
        orderReference: "POS-1001",
        issuedAt: "2026-09-14T18:02:00.000Z",
        locationName: "Main store",
        registerName: "Front Counter 1",
        cashierName: "Staff",
        customerLabel: "Walk-in",
        lines: [
          {
            name: "Canonical receipt line",
            quantity: "1",
            unitPrice: { minor: 1500, currency: "GHS" },
            total: { minor: 1500, currency: "GHS" },
          },
        ],
        subtotal: { minor: 1500, currency: "GHS" },
        discount: { minor: 0, currency: "GHS" },
        tax: { minor: 0, currency: "GHS" },
        total: { minor: 1500, currency: "GHS" },
        tender: "cash",
        changeDue: { minor: 500, currency: "GHS" },
        documentKind: "operational_pos_receipt",
      },
    });
    expect(ready).toContain('data-receipt-source="receipt-port"');
    expect(ready).toContain("R-PORT-99");
    expect(ready).toContain("Canonical receipt line");
    expect(ready).not.toContain("Epoxy Hardener");
  });

  test("cash_failed after a prepared sale is not dismissible and prepare_failed without a prepared sale is", () => {
    const cashFailed = render({
      ...idleCheckoutSession(),
      stage: "cash_failed",
      prepared: {
        transactionId: "tx",
        saleId: "sale",
        orderReference: "POS-1",
        quoteFingerprint: "fp",
        total: { minor: 1500, currency: "GHS" },
      },
    });
    expect(cashFailed).toContain('data-checkout-dismissable="false"');
    expect(cashFailed).toContain("Confirm cash");
    expect(cashFailed).not.toContain("Keep cart");
    const prepareFailed = render({ ...idleCheckoutSession(), stage: "prepare_failed", message: "Stock changed" });
    expect(prepareFailed).toContain('data-checkout-dismissable="true"');
    expect(prepareFailed).toContain("Keep cart");
  });

  test("successful prepare shows Choose payment rather than Cash", () => {
    const html = render({
      ...idleCheckoutSession(),
      stage: "choose_payment",
      prepared: {
        transactionId: "tx",
        saleId: "sale",
        orderReference: "POS-woo-1",
        quoteFingerprint: "fp",
        total: { minor: 1_000_033_400, currency: "GHS" },
      },
    });
    expect(html).toContain("Choose payment");
    expect(html).toContain("POS-woo-1");
    expect(html).toContain("GHS 10,000,334.00");
    expect(html).toContain('data-tender="cash"');
    expect(html).toContain('data-tender="mobile_money"');
    expect(html).toContain("Not enabled on this POS");
    expect(html).toContain("Cancel sale");
    expect(html).not.toContain("Confirm cash");
    expect(html).not.toContain("Demo controls");
    expect(html).not.toContain("Simulated");
  });
});
