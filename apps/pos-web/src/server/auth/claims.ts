import type { Session } from "../../../../../docs/contracts/domain.generated";
import { isPosId, isTimestamp } from "./ids";

export type StaffIdentityClaims = {
  readonly actorId: string;
  readonly displayName: string;
  readonly organizationId: string;
  readonly locationIds: readonly string[];
  readonly registerId: string | null;
  readonly capabilities: readonly string[];
  readonly expiresAt: string;
};

/**
 * Map a verified Supabase Auth user/JWT-shaped payload onto staff claims.
 * Buyer/customer fields never become staff identity.
 */
export function parseStaffIdentityClaims(payload: unknown): StaffIdentityClaims | null {
  if (payload === null || typeof payload !== "object") {
    return null;
  }
  const root = payload as Record<string, unknown>;
  const appMetadata =
    root.app_metadata !== null && typeof root.app_metadata === "object"
      ? (root.app_metadata as Record<string, unknown>)
      : {};
  const userMetadata =
    root.user_metadata !== null && typeof root.user_metadata === "object"
      ? (root.user_metadata as Record<string, unknown>)
      : {};

  if (hasBuyerIdentity(appMetadata, userMetadata, root)) {
    return null;
  }

  const actorId = firstString(appMetadata.actor_id, root.actor_id);
  const organizationId = firstString(appMetadata.organization_id, root.organization_id);
  const locationIds = parseIdList(appMetadata.location_ids ?? root.location_ids);
  const registerIdRaw = firstString(appMetadata.register_id, root.register_id);
  const displayName = firstString(userMetadata.display_name, root.display_name, root.email) ?? actorId;
  const expiresAt = parseExpiry(root.exp, root.expiresAt);
  const capabilities = parseStringList(appMetadata.capabilities ?? root.capabilities);

  if (!isPosId(actorId) || !isPosId(organizationId) || locationIds === null || !expiresAt) {
    return null;
  }
  if (registerIdRaw !== undefined && registerIdRaw !== null && !isPosId(registerIdRaw)) {
    return null;
  }
  if (locationIds.some((id) => !isPosId(id))) {
    return null;
  }
  if (!displayName || displayName.length < 1) {
    return null;
  }

  return {
    actorId,
    displayName,
    organizationId,
    locationIds,
    registerId: registerIdRaw && isPosId(registerIdRaw) ? registerIdRaw : null,
    capabilities,
    expiresAt,
  };
}

export function toSession(claims: StaffIdentityClaims): Session {
  return {
    actorId: claims.actorId,
    displayName: claims.displayName,
    organizationId: claims.organizationId,
    locationIds: [...claims.locationIds],
    capabilities: [...claims.capabilities],
    expiresAt: claims.expiresAt,
  };
}

/** Fail closed if a stored session payload is missing required staff fields. */
export function parseSession(value: unknown): Session | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const root = value as Record<string, unknown>;
  const actorId = firstString(root.actorId);
  const displayName = firstString(root.displayName);
  const organizationId = firstString(root.organizationId);
  const locationIds = parseIdList(root.locationIds);
  const expiresAt = isTimestamp(root.expiresAt) ? root.expiresAt : null;
  if (!isPosId(actorId) || !isPosId(organizationId) || locationIds === null || !expiresAt || !displayName) {
    return null;
  }
  if (locationIds.some((id) => !isPosId(id))) {
    return null;
  }
  return {
    actorId,
    displayName,
    organizationId,
    locationIds,
    capabilities: parseStringList(root.capabilities),
    expiresAt,
  };
}

function hasBuyerIdentity(
  appMetadata: Record<string, unknown>,
  userMetadata: Record<string, unknown>,
  root: Record<string, unknown>,
): boolean {
  const customerId = firstString(appMetadata.customer_id, userMetadata.customer_id, root.customer_id);
  const actorId = firstString(appMetadata.actor_id, root.actor_id);
  const kind = firstString(appMetadata.kind, appMetadata.subject_kind, root.kind);
  if (kind === "retail" || kind === "b2b" || kind === "customer" || kind === "buyer") {
    return true;
  }
  if (customerId && (!actorId || customerId === actorId)) {
    return true;
  }
  return false;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function parseIdList(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      return null;
    }
    ids.push(item);
  }
  return ids;
}

function parseStringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function parseExpiry(exp: unknown, expiresAt: unknown): string | null {
  if (isTimestamp(expiresAt)) {
    return expiresAt;
  }
  if (typeof exp === "number" && Number.isFinite(exp)) {
    return new Date(exp * 1000).toISOString();
  }
  return null;
}
