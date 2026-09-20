import type { ReleasePolicy } from "../../../../docs/contracts/domain.generated";
import { openPosLocalDatabase, type PosLocalDatabase } from "./pos-local-db";

export type UpdateBlockReason =
  | "PASSIVE_WINDOW"
  | "ACTIVE_TENDER"
  | "CRITICAL_OPERATION_PENDING"
  | "SYNC_MUTATION_IN_PROGRESS"
  | "LOCAL_MIGRATION_IN_PROGRESS"
  | "UNSUPPORTED_APP_VERSION";

export type UpdateActivationDecision =
  | { readonly safe: true }
  | { readonly safe: false; readonly reasons: ReadonlyArray<UpdateBlockReason> };

export interface UpdateSafetySnapshot {
  readonly activeTender: boolean;
  readonly criticalOperationCount: number;
  readonly syncMutationInProgress: boolean;
  readonly localMigrationInProgress: boolean;
  readonly activeWindow: boolean;
  readonly appBuild: string;
  readonly releasePolicy?: ReleasePolicy;
}

/**
 * Pure safety gate for activating a waiting service worker/app update.
 * A waiting update is never permission to interrupt money movement or durable recovery work.
 */
export function assessUpdateActivation(snapshot: UpdateSafetySnapshot): UpdateActivationDecision {
  const reasons: UpdateBlockReason[] = [];

  if (!snapshot.activeWindow) {
    reasons.push("PASSIVE_WINDOW");
  }
  if (snapshot.activeTender) {
    reasons.push("ACTIVE_TENDER");
  }
  if (snapshot.criticalOperationCount > 0) {
    reasons.push("CRITICAL_OPERATION_PENDING");
  }
  if (snapshot.syncMutationInProgress) {
    reasons.push("SYNC_MUTATION_IN_PROGRESS");
  }
  if (snapshot.localMigrationInProgress) {
    reasons.push("LOCAL_MIGRATION_IN_PROGRESS");
  }
  if (
    snapshot.releasePolicy &&
    isBelowMinimumSupportedBuild(snapshot.appBuild, snapshot.releasePolicy.minimumSupportedBuild)
  ) {
    reasons.push("UNSUPPORTED_APP_VERSION");
  }

  return reasons.length === 0 ? { safe: true } : { safe: false, reasons };
}

const GIT_SHA1_BUILD_IDENTITY = /^[0-9a-f]{40}$/i;

function isOpaqueBuildIdentity(value: string): boolean {
  return GIT_SHA1_BUILD_IDENTITY.test(value);
}

function parseOrderableAppVersion(value: string): ReadonlyArray<number> | null {
  if (isOpaqueBuildIdentity(value)) {
    return null;
  }
  if (!/^\d+(?:\.\d+)*$/.test(value)) {
    return null;
  }
  return value.split(".").map((part) => Number(part));
}

function compareOrderableAppVersions(left: ReadonlyArray<number>, right: ReadonlyArray<number>): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) {
      return a > b ? 1 : -1;
    }
  }
  return 0;
}

/**
 * Advertised-build identity comparison for release discovery.
 * This is not minimum-supported-version ordering.
 *
 * Equal IDs are the same advertised identity. Genuinely orderable numeric/dotted
 * app versions compare numerically so an older running app can discover a newer
 * advertised worker. Opaque identities (including 40-character Git SHAs) are not
 * version numbers: inequality is reported as negative so installed A can discover
 * advertised B. That does not mean A is below a compatibility minimum.
 */
export function compareBuildIds(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  const leftParts = parseOrderableAppVersion(left);
  const rightParts = parseOrderableAppVersion(right);
  if (!leftParts || !rightParts) {
    return -1;
  }
  return compareOrderableAppVersions(leftParts, rightParts);
}

/**
 * True when the running identity is a different advertised release that the
 * client should discover without loading the new application bundle first.
 * Opaque SHA inequality is sufficient. Orderable versions discover only a
 * numerically newer advertised identity.
 */
export function shouldDiscoverAdvertisedWorker(
  runningBuild: string,
  advertisedLatestBuild: string,
): boolean {
  return compareBuildIds(runningBuild, advertisedLatestBuild) < 0;
}

/**
 * Minimum-compatibility decision. Returns true only when `running` is proven
 * older than `minimum` under orderable numeric/dotted version semantics.
 * Equal IDs are never below minimum. Opaque/non-orderable identifiers, including
 * Git SHAs, never imply UNSUPPORTED_APP_VERSION merely because they differ.
 */
export function isBelowMinimumSupportedBuild(running: string, minimum: string): boolean {
  if (running === minimum) {
    return false;
  }
  const runningParts = parseOrderableAppVersion(running);
  const minimumParts = parseOrderableAppVersion(minimum);
  if (!runningParts || !minimumParts) {
    return false;
  }
  return compareOrderableAppVersions(runningParts, minimumParts) < 0;
}

const LIFECYCLE_LEASE_KEY = "pwa.lifecycle.leader";

interface LifecycleLease {
  readonly ownerId: string;
  readonly expiresAt: number;
}

export async function acquireLifecycleLease(
  ownerId: string,
  now: number,
  ttlMs: number,
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<boolean> {
  if (ownerId.length === 0 || ttlMs <= 0 || !Number.isFinite(now)) {
    throw new Error("invalid lifecycle lease input");
  }

  return db.transaction("rw", db.kv, async () => {
    const row = await db.kv.get(LIFECYCLE_LEASE_KEY);
    const current = row ? parseLease(row.value) : null;
    if (current && current.ownerId !== ownerId && current.expiresAt > now) {
      return false;
    }

    const lease: LifecycleLease = { ownerId, expiresAt: now + ttlMs };
    await db.kv.put({ key: LIFECYCLE_LEASE_KEY, value: JSON.stringify(lease) });
    return true;
  });
}

export async function renewLifecycleLease(
  ownerId: string,
  now: number,
  ttlMs: number,
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<boolean> {
  return db.transaction("rw", db.kv, async () => {
    const row = await db.kv.get(LIFECYCLE_LEASE_KEY);
    const current = row ? parseLease(row.value) : null;
    if (!current || current.ownerId !== ownerId || current.expiresAt <= now) {
      return false;
    }
    await db.kv.put({
      key: LIFECYCLE_LEASE_KEY,
      value: JSON.stringify({ ownerId, expiresAt: now + ttlMs } satisfies LifecycleLease),
    });
    return true;
  });
}

export async function releaseLifecycleLease(
  ownerId: string,
  db: PosLocalDatabase = openPosLocalDatabase(),
): Promise<void> {
  await db.transaction("rw", db.kv, async () => {
    const row = await db.kv.get(LIFECYCLE_LEASE_KEY);
    const current = row ? parseLease(row.value) : null;
    if (current?.ownerId === ownerId) {
      await db.kv.delete(LIFECYCLE_LEASE_KEY);
    }
  });
}

function parseLease(value: string): LifecycleLease | null {
  try {
    const parsed = JSON.parse(value) as Partial<LifecycleLease>;
    return typeof parsed.ownerId === "string" && typeof parsed.expiresAt === "number"
      ? { ownerId: parsed.ownerId, expiresAt: parsed.expiresAt }
      : null;
  } catch {
    return null;
  }
}
