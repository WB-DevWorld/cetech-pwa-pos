import { describe, expect, test } from "vitest";
import { presentHealthRows } from "./healthPresentation";

describe("Store Health presentation", () => {
  test("does not claim electronic payments are available when capability is unverified", () => {
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
    const payments = rows.find((row) => row.id === "payments");
    expect(payments?.badge).toBe("Unverified");
    expect(payments?.detail).toContain("Electronic methods are not confirmed");
    expect(rows.find((row) => row.id === "catalog")?.detail).toBe("Fresh");
    expect(rows.find((row) => row.name === "App version")?.badge).toBe("OK");
  });

  test("uses real internet and catalog tones", () => {
    const offline = presentHealthRows({ online: false, catalogAvailability: "unavailable", electronicPaymentsAvailable: false });
    expect(offline.find((row) => row.id === "internet")?.badge).toBe("Unavailable");
    expect(offline.find((row) => row.id === "catalog")?.badge).toBe("Unavailable");
  });
});
