import type { Session } from "../../../../../docs/contracts/domain.generated";

/**
 * BFF composition around frozen Session. Assignment ids are server-owned and
 * never taken from client/JWT capability lists.
 */
export type StaffSessionContext = {
  readonly session: Session;
  readonly assignedLocationIds: readonly string[];
  readonly assignedRegisterIds: readonly string[];
  readonly mustChangePassword?: boolean;
};

export function parseStaffSessionContext(value: unknown): StaffSessionContext | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const root = value as Record<string, unknown>;
  const session = parseSessionPayload(root.session ?? root);
  if (!session) {
    return null;
  }
  const assignedLocationIds = parseIdList(root.assignedLocationIds) ?? session.locationIds;
  const assignedRegisterIds = parseIdList(root.assignedRegisterIds) ?? [];
  return {
    session,
    assignedLocationIds,
    assignedRegisterIds,
    mustChangePassword: root.mustChangePassword === true,
  };
}

function parseSessionPayload(value: unknown): Session | null {
  if (value === null || typeof value !== "object") {
    return null;
  }
  const root = value as Record<string, unknown>;
  const actorId = asNonEmptyString(root.actorId);
  const displayName = asNonEmptyString(root.displayName);
  const organizationId = asNonEmptyString(root.organizationId);
  const expiresAt = asNonEmptyString(root.expiresAt);
  const locationIds = parseIdList(root.locationIds);
  if (!actorId || !displayName || !organizationId || !expiresAt || !locationIds) {
    return null;
  }
  return {
    actorId,
    displayName,
    organizationId,
    locationIds,
    capabilities: parseIdList(root.capabilities) ?? [],
    expiresAt,
  };
}

function parseIdList(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length < 1) {
      return null;
    }
    ids.push(item);
  }
  return ids;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
