import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BridgeCommercialRefundRequest,
  BridgeStockDispositionRequest,
} from "../../../docs/contracts/domain.generated";
import { createInMemoryCheckoutStore } from "../../../apps/pos-web/src/core/checkout/in-memory-store";
import { createInMemoryReturnStore } from "../../../apps/pos-web/src/core/returns/in-memory-store";
import { buildCommercialRefundCommand, buildStockDispositionCommand } from "../../../apps/pos-web/src/server/returns/bridge-commands";
import { previewReturn } from "../../../apps/pos-web/src/server/returns/preview";
import {
  CORRELATION,
  LINE_1,
  NOW,
  seedCompletedSale,
  seedRegister,
} from "./helpers";

export type Ws3SaleMeta = {
  readonly transactionId: string;
  readonly saleId: string;
  readonly quoteFingerprint: string;
  readonly orderLineId: string;
  readonly quantity: string;
  readonly lineTotalMinor: number;
  readonly currency: string;
};

export type Ws3GeneratedCommands = {
  readonly partial1: BridgeCommercialRefundRequest;
  readonly partial2: BridgeCommercialRefundRequest;
  readonly stock: BridgeStockDispositionRequest;
  readonly previewEconomicsVersion: string;
  readonly firstRefundMinor: number;
  readonly secondRefundMinor: number;
};

const COMMERCIAL_1 = "c1111111-1111-4111-8111-111111111101";
const COMMERCIAL_2 = "c2222222-2222-4222-8222-222222222202";
const STOCK_1 = "d1111111-1111-4111-8111-111111111101";
const RETURN_1 = "e1111111-1111-4111-8111-111111111101";
const RETURN_2 = "e2222222-2222-4222-8222-222222222202";

export async function generateWs3BridgeCommands(meta: Ws3SaleMeta): Promise<Ws3GeneratedCommands> {
  const checkoutStore = createInMemoryCheckoutStore();
  const returnStore = createInMemoryReturnStore();
  await seedRegister(checkoutStore);
  const shiftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10";
  await checkoutStore.insertOpenShift({
    id: shiftId,
    organizationId: "org_a",
    locationId: "loc_a1",
    registerId: "reg_a1",
    deviceId: "44444444-4444-4444-8444-444444444444",
    cashierId: "cashier_a",
    status: "open",
    openingFloat: { minor: 10000, currency: meta.currency },
    expectedCash: { minor: 10000, currency: meta.currency },
    openedAt: "2026-09-15T12:00:00.000Z",
  });
  await seedCompletedSale(checkoutStore, {
    transactionId: meta.transactionId,
    saleId: meta.saleId,
    shiftId,
    quantity: meta.quantity,
    lineTotal: { minor: meta.lineTotalMinor, currency: meta.currency },
  });
  const sale = await checkoutStore.getSaleBySaleId("org_a", meta.saleId);
  if (!sale?.prepared) {
    throw new Error("seeded sale missing prepared snapshot");
  }
  sale.prepared = { ...sale.prepared, quoteFingerprint: meta.quoteFingerprint };
  if (sale.orderLines?.[0] && meta.orderLineId !== LINE_1) {
    sale.orderLines = [{ ...sale.orderLines[0], orderLineId: meta.orderLineId }];
  }
  await checkoutStore.saveSale(sale);

  const first = await previewReturn({
    checkoutStore,
    returnStore,
    actor: {
      actorId: "cashier_a",
      displayName: "Cashier A",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
    },
    request: {
      saleId: meta.saleId,
      lines: [
        {
          orderLineId: meta.orderLineId === LINE_1 || !meta.orderLineId ? LINE_1 : meta.orderLineId,
          quantity: "1",
          reason: "customer changed mind",
          condition: "resellable",
        },
      ],
    },
    correlationId: CORRELATION,
    now: NOW,
  });
  if (!first.ok) {
    throw new Error(`first preview failed: ${first.error.message}`);
  }
  const stored1 = await returnStore.getReturn(first.data.returnId);
  if (!stored1) {
    throw new Error("first preview was not persisted");
  }
  const commercial1 = {
    commercialRefundId: COMMERCIAL_1,
    returnId: RETURN_1,
    organizationId: stored1.organizationId,
    locationId: stored1.locationId,
    transactionId: stored1.transactionId,
    saleId: stored1.saleId,
    amount: stored1.refundTotal,
    economicsVersion: stored1.economicsVersion,
    fingerprint: stored1.fingerprint,
    status: "pending" as const,
  };
  const stockRow = {
    stockDispositionId: STOCK_1,
    returnId: RETURN_1,
    organizationId: stored1.organizationId,
    locationId: stored1.locationId,
    transactionId: stored1.transactionId,
    saleId: stored1.saleId,
    economicsVersion: stored1.economicsVersion,
    fingerprint: stored1.fingerprint,
    status: "pending" as const,
  };
  const partial1 = buildCommercialRefundCommand({ stored: stored1, commercial: commercial1 });
  const stock = buildStockDispositionCommand({ stored: stored1, stock: stockRow });

  stored1.executeClaimedAt = undefined;
  await returnStore.saveReturn(stored1);
  const claimed = await returnStore.claimExecution(stored1.returnId, "2026-09-15T16:01:00.000Z");
  if (claimed !== "claimed") {
    throw new Error(`first claim failed: ${claimed}`);
  }

  const second = await previewReturn({
    checkoutStore,
    returnStore,
    actor: {
      actorId: "cashier_a",
      displayName: "Cashier A",
      organizationId: "org_a",
      locationIds: ["loc_a1"],
    },
    request: {
      saleId: meta.saleId,
      lines: [
        {
          orderLineId: stored1.requestedLines[0]?.orderLineId ?? LINE_1,
          quantity: "1",
          reason: "customer changed mind",
          condition: "resellable",
        },
      ],
    },
    correlationId: CORRELATION,
    now: NOW,
  });
  if (!second.ok) {
    throw new Error(`second preview failed: ${second.error.message}`);
  }
  const stored2 = await returnStore.getReturn(second.data.returnId);
  if (!stored2) {
    throw new Error("second preview was not persisted");
  }
  const commercial2 = {
    commercialRefundId: COMMERCIAL_2,
    returnId: RETURN_2,
    organizationId: stored2.organizationId,
    locationId: stored2.locationId,
    transactionId: stored2.transactionId,
    saleId: stored2.saleId,
    amount: stored2.refundTotal,
    economicsVersion: stored2.economicsVersion,
    fingerprint: stored2.fingerprint,
    status: "pending" as const,
  };
  const partial2 = buildCommercialRefundCommand({ stored: stored2, commercial: commercial2 });
  return {
    partial1,
    partial2,
    stock,
    previewEconomicsVersion: first.data.economicsVersion,
    firstRefundMinor: first.data.refundTotal.minor,
    secondRefundMinor: second.data.refundTotal.minor,
  };
}

export function fixtureDirectory(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "../../bridge/fixtures/ws3-generated");
}

export function writeWs3GeneratedFixtures(commands: Ws3GeneratedCommands): void {
  const dir = fixtureDirectory();
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "commercial-partial-1.json"), `${JSON.stringify(commands.partial1, null, 2)}\n`);
  writeFileSync(join(dir, "commercial-partial-2.json"), `${JSON.stringify(commands.partial2, null, 2)}\n`);
  writeFileSync(join(dir, "stock-disposition.json"), `${JSON.stringify(commands.stock, null, 2)}\n`);
  writeFileSync(
    join(dir, "manifest.json"),
    `${JSON.stringify(
      {
        previewEconomicsVersion: commands.previewEconomicsVersion,
        firstRefundMinor: commands.firstRefundMinor,
        secondRefundMinor: commands.secondRefundMinor,
      },
      null,
      2,
    )}\n`,
  );
}
