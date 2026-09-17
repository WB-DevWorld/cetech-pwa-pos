import { describe, expect, test } from "vitest";
import { projectHistoricReturnSale } from "../../../apps/pos-web/src/server/returns/historic-sale-projection";
import { LINE_1, createRt01Runtime } from "./helpers";

describe("projectHistoricReturnSale", () => {
  test("identity comes from durable orderLines, never receipt index", async () => {
    const runtime = await createRt01Runtime();
    const sale = await runtime.checkoutStore.getSaleBySaleId("org_a", "woo-rt01");
    expect(sale?.status).toBe("completed");
    const projected = projectHistoricReturnSale(sale!);
    expect(projected?.lines).toHaveLength(1);
    expect(projected?.lines[0]?.orderLineId).toBe(sale?.orderLines?.[0]?.orderLineId);
    expect(projected?.lines[0]?.orderLineId).toBe(LINE_1);
    expect(projected?.lines[0]?.orderLineId).not.toBe(`woo-rt01:receipt:0`);
    expect(projected?.lines[0]?.name).toBe("Hardener");
    expect(projected?.lines[0]?.originalSoldQuantity).toBe(sale?.orderLines?.[0]?.quantity);
    expect(projected?.saleId).toBe("woo-rt01");
  });

  test("falls back to Sale line <orderLineId> when display names are not aligned", async () => {
    const runtime = await createRt01Runtime();
    const sale = await runtime.checkoutStore.getSaleBySaleId("org_a", "woo-rt01");
    expect(sale).toBeTruthy();
    if (!sale) {
      return;
    }
    const projected = projectHistoricReturnSale({ ...sale, lines: [] });
    expect(projected?.lines[0]?.orderLineId).toBe(LINE_1);
    expect(projected?.lines[0]?.name).toBe(`Sale line ${LINE_1}`);
  });

  test("does not project a non-completed sale", async () => {
    const runtime = await createRt01Runtime();
    const sale = await runtime.checkoutStore.getSaleBySaleId("org_a", "woo-rt01");
    expect(sale).toBeTruthy();
    if (!sale) {
      return;
    }
    expect(projectHistoricReturnSale({ ...sale, status: "finalizing" })).toBeUndefined();
  });

  test("does not project a completed sale missing orderLines", async () => {
    const runtime = await createRt01Runtime();
    const sale = await runtime.checkoutStore.getSaleBySaleId("org_a", "woo-rt01");
    expect(sale).toBeTruthy();
    if (!sale) {
      return;
    }
    expect(projectHistoricReturnSale({ ...sale, orderLines: undefined })).toBeUndefined();
    expect(projectHistoricReturnSale({ ...sale, orderLines: [] })).toBeUndefined();
  });
});
