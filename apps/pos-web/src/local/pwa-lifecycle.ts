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
    compareBuildIds(snapshot.appBuild, snapshot.releasePolicy.minimumSupportedBuild) < 0
  ) {
    reasons.push("UNSUPPORTED_APP_VERSION");
  }

  return reasons.length === 0 ? { safe: true } : { safe: false, reasons };
}

/**
 * Build IDs are compared as dot-separated non-negative integer sequences when possible.
 * Unknown formats compare conservatively by exact equality only.
 */
export function compareBuildIds(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  const leftParts = parseNumericBuild(left);
  const rightParts = parseNumericBuild(right);
  if (!leftParts || !rightParts) {
    return -1;
  }
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const a = leftParts[index] ?? 0;
    const b = rightParts[index] ?? 0;
    if (a !== b) {
      return a > b ? 1 : -1;
    }
  }
  return 0;
}

function parseNumericBuild(value: string): ReadonlyArray<number> | null {
  if (!/^\d+(?:\.\d+)*$/.test(value)) {
    return null;
  }
  return value.split(".").map((part) => Number(part));
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
