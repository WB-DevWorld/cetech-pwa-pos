import { describe, expect, test } from "vitest";
import { createSupabaseReturnStore } from "./supabase-return-store";

const RETURN_ID = "2cff2661-ef0b-4833-b4db-fbc263a401b8";

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Supabase return adapter canonical quantities", () => {
  test("hydrates fixed-scale database numerics back into frozen Quantity strings", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/pos_returns?")) {
        return json([
          {
            return_id: RETURN_ID,
            organization_id: "org_a",
            location_id: "loc_a1",
            register_id: "reg_a",
            shift_id: "e82217c6-3e20-4131-abbb-1b6668e2622b",
            actor_id: "cashier_a",
            transaction_id: "c87cfa45-6b05-4ea9-910c-6ebdd2e0a63e",
            sale_id: "sale-49816",
            economics_version: "01003b25a210f5ce8dab178c405babb5f49258b6f2a71daf9b6392ee7882788e",
            fingerprint: "7b36ce64c28e8f18d0b7a90d11b311145c0299c526d94f50583f0542c7d2a962",
            preview_expires_at: "2026-09-24T00:00:00.000Z",
            approval_required: false,
            refund_total_minor: 2000,
            refund_currency: "GHS",
            status: "previewed",
            execute_claimed_at: null,
          },
        ]);
      }
      if (url.includes("/pos_return_historic_lines?")) {
        return json([
          {
            return_id: RETURN_ID,
            order_line_id: "line-a",
            original_sold_quantity: "1.000000",
            previously_returned_quantity: "0.000000",
            remaining_returnable_quantity: "1.000000",
            historical_subtotal_minor: 2000,
            historical_discount_minor: 0,
            historical_tax_minor: 0,
            historical_total_minor: 2000,
            currency: "GHS",
          },
        ]);
      }
      if (url.includes("/pos_return_requested_lines?")) {
        return json([
          {
            return_id: RETURN_ID,
            order_line_id: "line-a",
            quantity: "1.000000",
            reason: "customer return",
            condition: "resellable",
            intended_disposition: "restock_sellable",
            disposition_policy: "automatic_sellable_restock",
            remaining_returnable_quantity: "1.000000",
            allocated_historic_amount_minor: 2000,
            allocated_historic_currency: "GHS",
          },
        ]);
      }
      if (
        url.includes("/pos_return_historic_tenders?") ||
        url.includes("/pos_tender_refunds?") ||
        url.includes("/pos_commercial_refunds?") ||
        url.includes("/pos_stock_dispositions?")
      ) {
        return json([]);
      }
      throw new Error(`unexpected return-store request: ${url}`);
    }) as typeof fetch;

    const store = createSupabaseReturnStore({
      url: "https://example.supabase.co",
      serviceRoleKey: "test-service-role",
      fetchImpl,
    });

    const record = await store.getReturn(RETURN_ID);
    expect(record).toBeDefined();
    expect(record?.historicLines[0]?.originalSoldQuantity).toBe("1");
    expect(record?.historicLines[0]?.previouslyReturnedQuantity).toBe("0");
    expect(record?.historicLines[0]?.remainingReturnableQuantity).toBe("1");
    expect(record?.requestedLines[0]?.requestedQuantity).toBe("1");
    expect(record?.requestedLines[0]?.quantity).toBe("1");
    expect(record?.requestedLines[0]?.remainingReturnableQuantity).toBe("1");
  });
});
