import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import { assessUpdateActivation } from "./pwa-lifecycle";
import { closePosLocalDatabase, deletePosLocalDatabase, openPosLocalDatabase } from "./pos-local-db";
import { createTenderActivityPort, hasActiveTender } from "./tender-activity";

const opened = new Set<string>();

afterEach(async () => {
  await Promise.all([...opened].map((name) => deletePosLocalDatabase(name)));
  opened.clear();
});

describe("R9 durable tender activity", () => {
  test("a tender started by one POS window blocks update activation in another window", async () => {
    const name = `r9-tender-${crypto.randomUUID()}`;
    opened.add(name);
    const firstWindow = openPosLocalDatabase(name);
    const tender = createTenderActivityPort(firstWindow, () => 1_000, 60_000);
    await tender.markActive("tx-1");

    await closePosLocalDatabase(name);
    const secondWindow = openPosLocalDatabase(name);
    const activeTender = await hasActiveTender(secondWindow, 2_000);

    expect(activeTender).toBe(true);
    expect(
      assessUpdateActivation({
        activeTender,
        criticalOperationCount: 0,
        syncMutationInProgress: false,
        localMigrationInProgress: false,
        activeWindow: true,
        appBuild: "2.0.0",
      }),
    ).toEqual({ safe: false, reasons: ["ACTIVE_TENDER"] });
  });

  test("terminal cleanup or lease expiry releases the tender block without deleting other local state", async () => {
    const name = `r9-tender-${crypto.randomUUID()}`;
    opened.add(name);
    const db = openPosLocalDatabase(name);
    const tender = createTenderActivityPort(db, () => 1_000, 5_000);

    await db.cartDrafts.put({
      cartId: "11111111-1111-4111-8111-111111111111",
      revision: 1,
      customer: { kind: "walkin" },
      locationId: "loc-1",
      lines: [],
      updatedAt: "2026-09-16T12:00:00.000Z",
    });
    await tender.markActive("tx-1");
    expect(await hasActiveTender(db, 2_000)).toBe(true);

    await tender.clear("tx-1");
    expect(await hasActiveTender(db, 2_001)).toBe(false);
    expect(await db.cartDrafts.count()).toBe(1);

    await tender.markActive("tx-2");
    expect(await hasActiveTender(db, 6_001)).toBe(false);
    expect(await db.cartDrafts.count()).toBe(1);
  });
});
