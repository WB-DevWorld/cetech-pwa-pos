import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { FINGERPRINT, LINE_1, createRt01Runtime, execute, ghs, preview } from "./helpers";
import { createInMemoryReturnStore } from "../../../apps/pos-web/src/core/returns/in-memory-store";
import { createSupabaseReturnStore } from "../../../apps/pos-web/src/server/returns/supabase-return-store";
import { createFakePosgrest } from "../sales/fake-posgrest";
import { buildCommercialRefundCommand } from "../../../apps/pos-web/src/server/returns/bridge-commands";
import { stockCommandLines } from "../../../apps/pos-web/src/core/returns/disposition";
import {
  generateWs3BridgeCommands,
  writeWs3GeneratedFixtures,
  fixtureDirectory,
  type Ws3SaleMeta,
} from "./generate-ws3-bridge-commands";

const ODD_TOTAL = 3001;

function defaultMeta(overrides: Partial<Ws3SaleMeta> = {}): Ws3SaleMeta {
  return {
    transactionId: "11111111-1111-4111-8111-111111111401",
    saleId: "woo-rt01",
    quoteFingerprint: FINGERPRINT,
    orderLineId: LINE_1,
    quantity: "2",
    lineTotalMinor: ODD_TOTAL,
    currency: "GHS",
    ...overrides,
  };
}

describe("R8-01 economicsVersion binding", () => {
  test("preview economicsVersion is the prepared sale quoteFingerprint", async () => {
    const runtime = await createRt01Runtime();
    const result = await preview(runtime, { quantity: "1" });
    expect(result.body.ok).toBe(true);
    if (!result.body.ok) {
      return;
    }
    const sale = await runtime.checkoutStore.getSaleBySaleId("org_a", "woo-rt01");
    expect(result.body.data.economicsVersion).toBe(sale?.prepared.quoteFingerprint);
    expect(result.body.data.economicsVersion).toBe(FINGERPRINT);
    const stored = await runtime.returnStore.getReturn(result.body.data.returnId);
    expect(stored?.economicsVersion).toBe(FINGERPRINT);
    expect(result.body.data.refundTotal).toEqual(ghs(1500));
  });
});

describe("R8-01 partial historic allocation persistence", () => {
  test("preview persists the exact lineRefund and execute uses it, not the full historic total", async () => {
    const runtime = await createRt01Runtime();
    const captured: { historicAmountMinor?: number; amountMinor?: number } = {};
    const originalApply = runtime.bridge.applyCommercialRefund.bind(runtime.bridge);
    runtime.bridge.applyCommercialRefund = async (input, context) => {
      captured.historicAmountMinor = input.lineAllocations[0]?.historicAmount.minor;
      captured.amountMinor = input.amount.minor;
      return originalApply(input, context);
    };
    const first = await preview(runtime, { quantity: "1" });
    expect(first.body.ok).toBe(true);
    if (!first.body.ok) {
      return;
    }
    const stored = await runtime.returnStore.getReturn(first.body.data.returnId);
    expect(stored?.requestedLines[0]?.allocatedHistoricAmount).toEqual(ghs(1500));
    expect(stored?.historicLines[0]?.historicalTotal).toEqual(ghs(3000));
    const reloaded = createInMemoryReturnStore();
    await reloaded.insertPreview(stored!);
    const afterRestart = await reloaded.getReturn(first.body.data.returnId);
    expect(afterRestart?.requestedLines[0]?.allocatedHistoricAmount).toEqual(ghs(1500));
    const executed = await execute(
      runtime,
      { returnId: first.body.data.returnId, fingerprint: first.body.data.fingerprint },
      "66666666-6666-4666-8666-666666666601",
    );
    expect(executed.body.ok).toBe(true);
    expect(captured.amountMinor).toBe(1500);
    expect(captured.historicAmountMinor).toBe(1500);
  });

  test("supabase serialization keeps allocatedHistoricAmount across reload", async () => {
    const runtime = await createRt01Runtime();
    const first = await preview(runtime, { quantity: "1" });
    expect(first.body.ok).toBe(true);
    if (!first.body.ok) {
      return;
    }
    const stored = await runtime.returnStore.getReturn(first.body.data.returnId);
    expect(stored).toBeTruthy();
    const fake = createFakePosgrest();
    const durable = createSupabaseReturnStore({
      url: "http://posgrest.test",
      serviceRoleKey: "service-role-test",
      fetchImpl: fake.fetchImpl,
    });
    await durable.insertPreview(stored!);
    const loaded = await durable.getReturn(stored!.returnId);
    expect(loaded?.requestedLines[0]?.allocatedHistoricAmount).toEqual(ghs(1500));
    expect(loaded?.economicsVersion).toBe(FINGERPRINT);
  });

  test("odd-minor first and second partials sum to the historic line and cannot over-refund", async () => {
    const commands = await generateWs3BridgeCommands(defaultMeta());
    expect(commands.firstRefundMinor).toBe(1500);
    expect(commands.secondRefundMinor).toBe(1501);
    expect(commands.firstRefundMinor + commands.secondRefundMinor).toBe(ODD_TOTAL);
    expect(commands.partial1.amount.minor).toBe(1500);
    expect(commands.partial1.lineAllocations[0]?.historicAmount.minor).toBe(1500);
    expect(commands.partial2.amount.minor).toBe(1501);
    expect(commands.partial2.lineAllocations[0]?.historicAmount.minor).toBe(1501);
    expect(
      commands.partial1.lineAllocations.reduce((sum, line) => sum + line.historicAmount.minor, 0),
    ).toBe(commands.partial1.amount.minor);
    expect(
      commands.partial2.lineAllocations.reduce((sum, line) => sum + line.historicAmount.minor, 0),
    ).toBe(commands.partial2.amount.minor);

    const runtime = await createRt01Runtime({ lineTotal: ghs(ODD_TOTAL) });
    const first = await preview(runtime, { quantity: "1" });
    expect(first.body.ok).toBe(true);
    if (!first.body.ok) {
      return;
    }
    expect(first.body.data.refundTotal.minor).toBe(1500);
    await execute(
      runtime,
      { returnId: first.body.data.returnId, fingerprint: first.body.data.fingerprint },
      "66666666-6666-4666-8666-666666666601",
    );
    const second = await preview(runtime, { quantity: "1" });
    expect(second.body.ok).toBe(true);
    if (!second.body.ok) {
      return;
    }
    expect(second.body.data.refundTotal.minor).toBe(1501);
    await execute(
      runtime,
      { returnId: second.body.data.returnId, fingerprint: second.body.data.fingerprint },
      "66666666-6666-4666-8666-666666666602",
    );
    const third = await preview(runtime, { quantity: "1" });
    expect(third.body.ok).toBe(false);
    expect(await runtime.returnStore.acceptedRefundedMinor(runtime.paymentId)).toBe(ODD_TOTAL);
  });
});

describe("R8-01 WS3 generated bridge commands", () => {
  test("builders emit economicsVersion from quoteFingerprint and stock never restocks damaged", async () => {
    const commands = await generateWs3BridgeCommands(defaultMeta());
    writeWs3GeneratedFixtures(commands);
    expect(commands.previewEconomicsVersion).toBe(FINGERPRINT);
    expect(commands.partial1.economicsVersion).toBe(FINGERPRINT);
    expect(commands.partial2.economicsVersion).toBe(FINGERPRINT);
    expect(commands.stock.economicsVersion).toBe(FINGERPRINT);
    expect(commands.stock.lines.every((line) => line.disposition === "restock_sellable")).toBe(true);
    expect(
      stockCommandLines({
        locationId: "loc_a1",
        lines: [
          {
            orderLineId: LINE_1,
            quantity: "1",
            condition: "damaged",
            intendedDisposition: "no_automatic_restock",
          },
          {
            orderLineId: "cccccccc-cccc-4ccc-8ccc-cccccccccc02",
            quantity: "1",
            condition: "quarantine",
            intendedDisposition: "no_automatic_restock",
          },
          {
            orderLineId: "cccccccc-cccc-4ccc-8ccc-cccccccccc03",
            quantity: "1",
            condition: "not_physically_returned",
            intendedDisposition: "no_automatic_restock",
          },
        ],
      }),
    ).toEqual([]);
    const dir = fixtureDirectory();
    const written = JSON.parse(readFileSync(join(dir, "commercial-partial-1.json"), "utf8")) as {
      readonly economicsVersion: string;
      readonly amount: { readonly minor: number };
    };
    expect(written.economicsVersion).toBe(commands.partial1.economicsVersion);
    expect(written.amount.minor).toBe(commands.partial1.amount.minor);
    const rebuilt = buildCommercialRefundCommand({
      stored: {
        ...(await (async () => {
          const runtime = await createRt01Runtime();
          const previewed = await preview(runtime, { quantity: "1" });
          if (!previewed.body.ok) {
            throw new Error("preview failed");
          }
          return (await runtime.returnStore.getReturn(previewed.body.data.returnId))!;
        })()),
      },
      commercial: {
        commercialRefundId: commands.partial1.commercialRefundId,
        returnId: commands.partial1.returnId,
        organizationId: "org_a",
        locationId: "loc_a1",
        transactionId: commands.partial1.transactionId,
        saleId: commands.partial1.saleId,
        amount: commands.partial1.amount,
        economicsVersion: commands.partial1.economicsVersion,
        fingerprint: commands.partial1.fingerprint,
        status: "pending",
      },
    });
    expect(rebuilt.lineAllocations[0]?.historicAmount.minor).toBe(1500);
  });
});
