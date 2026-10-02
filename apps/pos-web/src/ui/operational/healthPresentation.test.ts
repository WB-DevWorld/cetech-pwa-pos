import { describe, expect, test } from "vitest";
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
    expect(rows.find((row) => row.id === "payments")?.detail).toContain("Electronic methods are not confirmed");
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
});
