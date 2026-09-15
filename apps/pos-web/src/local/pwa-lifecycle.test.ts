import "fake-indexeddb/auto";
import { afterEach, describe, expect, test } from "vitest";
import {
  acquireLifecycleLease,
  assessUpdateActivation,
  compareBuildIds,
  releaseLifecycleLease,
  renewLifecycleLease,
} from "./pwa-lifecycle";
import { deletePosLocalDatabase, openPosLocalDatabase } from "./pos-local-db";

const opened = new Set<string>();

function testDb() {
  const name = `core-07-${crypto.randomUUID()}`;
  opened.add(name);
  return openPosLocalDatabase(name);
}

afterEach(async () => {
  await Promise.all([...opened].map((name) => deletePosLocalDatabase(name)));
  opened.clear();
});

describe("CORE-07 update activation safety", () => {
  test("permits activation only at a safe active-window point", () => {
    expect(
      assessUpdateActivation({
        activeTender: false,
        criticalOperationCount: 0,
        syncMutationInProgress: false,
        localMigrationInProgress: false,
        activeWindow: true,
        appBuild: "1.4.0",
      }),
    ).toEqual({ safe: true });
  });

  test("blocks activation while tender, durable recovery, sync, migration, or passive-window work exists", () => {
    expect(
      assessUpdateActivation({
        activeTender: true,
        criticalOperationCount: 2,
        syncMutationInProgress: true,
        localMigrationInProgress: true,
        activeWindow: false,
        appBuild: "1.4.0",
      }),
    ).toEqual({
      safe: false,
      reasons: [
        "PASSIVE_WINDOW",
        "ACTIVE_TENDER",
        "CRITICAL_OPERATION_PENDING",
        "SYNC_MUTATION_IN_PROGRESS",
        "LOCAL_MIGRATION_IN_PROGRESS",
      ],
    });
  });

  test("marks builds below release policy minimum as unsupported", () => {
    const decision = assessUpdateActivation({
      activeTender: false,
      criticalOperationCount: 0,
      syncMutationInProgress: false,
      localMigrationInProgress: false,
      activeWindow: true,
      appBuild: "1.3.9",
      releasePolicy: {
        latestBuild: "1.5.0",
        recommendedBuild: "1.5.0",
        minimumSupportedBuild: "1.4.0",
        minimumApiVersion: "1.0.0",
        minimumLocalSchema: 4,
      },
    });
    expect(decision).toEqual({ safe: false, reasons: ["UNSUPPORTED_APP_VERSION"] });
  });

  test("numeric build comparison is deterministic and unknown formats fail conservatively", () => {
    expect(compareBuildIds("1.10.0", "1.9.9")).toBe(1);
    expect(compareBuildIds("1.0", "1.0.0")).toBe(0);
    expect(compareBuildIds("build-a", "build-a")).toBe(0);
    expect(compareBuildIds("build-b", "build-a")).toBe(-1);
  });
});

describe("CORE-07 multi-tab lifecycle lease", () => {
  test("only one tab owns a non-expired lifecycle lease", async () => {
    const db = testDb();
    expect(await acquireLifecycleLease("tab-a", 1_000, 5_000, db)).toBe(true);
    expect(await acquireLifecycleLease("tab-b", 2_000, 5_000, db)).toBe(false);
    expect(await renewLifecycleLease("tab-a", 2_500, 5_000, db)).toBe(true);
    expect(await renewLifecycleLease("tab-b", 2_500, 5_000, db)).toBe(false);
  });

  test("expired leases are recoverable and release cannot evict another owner", async () => {
    const db = testDb();
    expect(await acquireLifecycleLease("tab-a", 1_000, 1_000, db)).toBe(true);
    expect(await acquireLifecycleLease("tab-b", 2_001, 1_000, db)).toBe(true);
    await releaseLifecycleLease("tab-a", db);
    expect(await renewLifecycleLease("tab-b", 2_100, 1_000, db)).toBe(true);
    await releaseLifecycleLease("tab-b", db);
    expect(await acquireLifecycleLease("tab-c", 2_200, 1_000, db)).toBe(true);
  });
});
