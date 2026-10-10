import { describe, expect, test } from "vitest";
import { resolvePaymentMethodCapabilities } from "../../server/payments/method-capabilities";
import { presentHealthRows } from "./healthPresentation";

describe("Store Health presentation", () => {
  test("uses cashier-safe operational labels and does not expose app version diagnostics", () => {
    const rows = presentHealthRows({
      online: true,
      electronicPaymentsAvailable: false,
      catalogAvailability: "fresh",
      health: {
        checks: [{ id: "commerce", status: "healthy", message: "ok", checkedAt: "2026-09-19T10:00:00.000Z" }],
        contractVersion: "1.0.0",
        pendingOperationCount: 0,
        attentionCount: 0,
        buildId: "stg-01",
      },
    });
    expect(rows.find((row) => row.id === "payments")?.badge).toBe("Unverified");
    expect(rows.find((row) => row.id === "payments")?.detail).toContain("Payment setup has not been confirmed yet");
    expect(rows.find((row) => row.id === "catalog")?.name).toBe("Products");
    expect(rows.find((row) => row.id === "catalog")?.detail).toBe("Ready");
    expect(rows.find((row) => row.id === "commerce")?.name).toBe("Store connection");
    expect(rows.find((row) => row.id === "app-version")).toBeUndefined();
  });

  test("uses real internet and product tones", () => {
    const offline = presentHealthRows({ online: false, catalogAvailability: "unavailable", electronicPaymentsAvailable: false });
    expect(offline.find((row) => row.id === "internet")?.badge).toBe("Unavailable");
    expect(offline.find((row) => row.id === "catalog")?.badge).toBe("Unavailable");
  });

  test("a connected store can stay connected while pricing qualification is still pending", () => {
    const rows = presentHealthRows({
      online: true,
      health: {
        checks: [
          { id: "bridge", status: "healthy", message: "wooDetected=true woodmartDetected=false b2bkingDetected=true pricingParityVerified=false; detection is not pricing parity", checkedAt: "2026-10-10T06:00:00.000Z" },
          { id: "bridge-dependencies", status: "degraded", message: "missing or inactive dependencies: woodmart; detection is not pricing parity", checkedAt: "2026-10-10T06:00:00.000Z" },
          { id: "bridge-contract", status: "unverified", message: "wooDetected=true woodmartDetected=false b2bkingDetected=true pricingParityVerified=false; detection is not pricing parity", checkedAt: "2026-10-10T06:00:00.000Z" },
        ],
        contractVersion: "1.0.0",
        pendingOperationCount: 0,
        attentionCount: 0,
        buildId: "hidden",
      },
    });
    expect(rows.find((row) => row.id === "bridge")?.detail).toBe("Connected");
    expect(rows.find((row) => row.id === "bridge-dependencies")?.badge).toBe("Degraded");
    expect(rows.find((row) => row.id === "bridge-dependencies")?.detail).toContain("does not prove prices");
    expect(rows.find((row) => row.id === "bridge-contract")?.detail).toContain("Pricing qualification is still pending");
    expect(rows.find((row) => row.id === "bridge-contract")?.detail).not.toContain("pricingParityVerified");
  });

  test("payment rows keep manual Mobile Money distinct from Paystack test and live", () => {
    const testCheckout = presentHealthRows({
      online: true,
      paymentMethods: resolvePaymentMethodCapabilities({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "test",
        PAYSTACK_SECRET_KEY: "sk_test_example_key",
        PAYSTACK_CARD_ENABLED: "true",
      }),
    });
    const payments = testCheckout.find((row) => row.id === "payments");
    expect(payments?.detail).toContain("Cash is available");
    expect(payments?.detail).toContain("Manually confirmed Mobile Money is not set up");
    expect(payments?.detail).toContain("Paystack test checkout is configured");
    expect(payments?.detail).toContain("not ready for live payments");
    expect(payments?.detail).not.toContain("PAYSTACK");

    const live = presentHealthRows({
      online: true,
      paymentMethods: resolvePaymentMethodCapabilities({
        PAYMENT_PROVIDER: "paystack",
        PAYSTACK_MODE: "live",
        PAYSTACK_SECRET_KEY: "sk_test_example_key",
      }),
    });
    expect(live.find((row) => row.id === "payments")?.detail).toContain("Live electronic checkout is blocked");
  });
});
