import { describe, expect, test } from "vitest";
import {
  catalogRebuildCopy,
  describePaymentState,
  describeQuoteFailure,
  describeUnavailableItems,
  healthCheckLabel,
  printerCapabilityLabel,
  scannerCapabilityLabel,
  skuLabel,
  toCashierError,
} from "./index";

describe("toCashierError", () => {
  test("maps known codes to ordinary next-step copy without printing the code", () => {
    expect(toCashierError({ code: "SHIFT_REQUIRED" }).message).toBe("Start your shift before taking payment.");
    expect(toCashierError({ code: "QUOTE_EXPIRED" }).message).toBe("Price needs to be checked again.");
    expect(toCashierError({ code: "AUTH_REQUIRED" }).message).toBe("Your session ended. Sign in again.");
    expect(toCashierError({ code: "FORBIDDEN" }).message).toBe("You don't have permission to do this.");
    expect(toCashierError({ code: "PAYMENT_PENDING" }).message).toContain("Do not charge again");
    expect(toCashierError({ code: "INTEGRATION_UNAVAILABLE", domain: "quote" }).message).not.toContain("INTEGRATION_UNAVAILABLE");
    expect(toCashierError({ code: "SHIFT_REQUIRED" }).technical.code).toBe("SHIFT_REQUIRED");
  });

  test("does not print unknown backend messages as primary cashier copy", () => {
    const unsafe = [
      "Supabase service role request failed",
      "provider runtime returned invalid envelope",
      "internal operation 123 failed",
      "staff session store is unavailable",
    ];
    for (const message of unsafe) {
      const view = toCashierError({ message, domain: "auth" });
      expect(view.message).not.toContain(message);
      expect(view.message).toBe("Sign-in is temporarily unavailable. Try again.");
      expect(view.technical.message).toBe(message);
    }
    expect(toCashierError({ message: unsafe[0], domain: "quote" }).message).toBe(
      "Prices couldn't be checked. Check the connection and try again.",
    );
    expect(
      toCashierError({ message: "Enter the counted cash.", source: "presentation" }).message,
    ).toBe("Enter the counted cash.");
  });

  test("keeps domain-specific INTEGRATION_UNAVAILABLE copy", () => {
    expect(toCashierError({ code: "INTEGRATION_UNAVAILABLE", domain: "catalog" }).message).toBe(
      "Products couldn't be loaded. Check the connection and try again.",
    );
    expect(toCashierError({ code: "INTEGRATION_UNAVAILABLE", domain: "quote" }).message).toBe(
      "Prices couldn't be checked. Check the connection and try again.",
    );
  });
});

describe("describeQuoteFailure", () => {
  test("does not claim out of stock from a generic line rejection", () => {
    const view = describeQuoteFailure({
      code: "INTEGRATION_UNAVAILABLE",
      message: "WooCommerce rejected a quote line.",
      cartLineNames: ["Cable 48732", "Adapter 14985"],
    });
    expect(view.message).toBe(
      "One or more items can't be sold right now. Remove unavailable items or refresh products and try again.",
    );
    expect(view.message).not.toMatch(/out of stock/i);
    expect(view.message).not.toContain("WooCommerce");
    expect(view.technical.code).toBe("INTEGRATION_UNAVAILABLE");
    expect(view.technical.message).toContain("WooCommerce");
  });

  test("names the single cart line when the offending item cannot be proven", () => {
    const view = describeQuoteFailure({
      code: "VALIDATION_ERROR",
      message: "WooCommerce rejected a quote line.",
      cartLineNames: ["Cable 48732"],
    });
    expect(view.message).toBe("Cable 48732 can't be sold right now. Remove it or refresh products and try again.");
  });

  test("says out of stock only from authoritative quote problems", () => {
    const view = describeQuoteFailure({
      code: "INTEGRATION_UNAVAILABLE",
      message: "Line is not purchasable",
      quoteLines: [{ name: "Cable 48732", stockStatus: "out_of_stock", problems: [{ code: "OUT_OF_STOCK" }] }],
    });
    expect(view.message).toBe("Cable 48732 is out of stock. Remove it to continue.");
  });
});

describe("describeUnavailableItems", () => {
  test("does not infer stock from local presentation data", () => {
    expect(describeUnavailableItems({ cartLineNames: ["A", "B"] })).not.toMatch(/out of stock/i);
  });
});

describe("describePaymentState", () => {
  test("keeps Do not charge again for pending and reconciling states", () => {
    expect(describePaymentState("pending").message).toContain("Do not charge again");
    expect(describePaymentState("reconciling").title).toBe("Checking payment status…");
    expect(describePaymentState("initializing").title).toBe("Starting payment…");
    expect(describePaymentState("reconciling").message).not.toMatch(/tender|payment identity|provider callback/i);
  });
});

describe("labels", () => {
  test("formats SKU and health check names", () => {
    expect(skuLabel("14985")).toBe("SKU 14985");
    expect(skuLabel("SKU 14985")).toBe("SKU 14985");
    expect(healthCheckLabel("supabase")).toBe("POS data");
    expect(healthCheckLabel("bridge")).toBe("Commerce connection");
    expect(healthCheckLabel("bridge-contract")).toBe("Pricing verification");
  });

  test("catalog rebuild copy uses products language", () => {
    expect(catalogRebuildCopy({ phase: "success", itemCount: 155 })).toBe("Products updated — 155 items ready.");
    expect(catalogRebuildCopy({ phase: "rebuilding" })).toBe("Refreshing products…");
  });

  test("scanner and printer copy never claim a device is connected", () => {
    expect(scannerCapabilityLabel("Attached scanner (presentation only)")).toBe("Keyboard scanner input");
    expect(scannerCapabilityLabel("Connected scanner")).toBe("Keyboard scanner input");
    expect(printerCapabilityLabel("Receipt printer via PrintPort")).toBe("Browser print");
    expect(printerCapabilityLabel("Receipt printer")).toBe("Browser print");
  });
});
