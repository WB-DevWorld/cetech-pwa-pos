import type { StaffAssignmentRole } from "../auth/roles";
import { isStaffAssignmentRole } from "../auth/roles";
import { isOrganizationControlRole, type OrganizationControlRole } from "../auth/policy";
import type { PosRestFetch } from "../http/server-fetch";

export type StaffAccessLocation = {
  readonly locationId: string;
  readonly role: StaffAssignmentRole;
  readonly registerIds: readonly string[];
};

export type StaffAccessRecord = {
  readonly actorId: string;
  readonly displayName: string;
  readonly email?: string;
  readonly authStatus: "active" | "disabled";
  readonly posAccessStatus: "active" | "disabled";
  readonly controlRole: OrganizationControlRole | null;
  readonly locations: readonly StaffAccessLocation[];
  readonly createdAt?: string;
  readonly lastSignInAt?: string;
};

export interface StaffAccessDirectory {
  listOrganization(input: {
    readonly organizationId: string;
  }): Promise<readonly StaffAccessRecord[] | "unavailable">;
}

export function createMemoryStaffAccessDirectory(
  rows: readonly StaffAccessRecord[] = [],
): StaffAccessDirectory {
  return {
    async listOrganization() {
      return rows;
    },
  };
}

export function createSupabaseStaffAccessDirectory(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): StaffAccessDirectory {
  const base = input.url.replace(/\/+$/, "");
  const restRoot = `${base}/rest/v1`;
  const authRoot = `${base}/auth/v1`;
  const timeoutMs = input.timeoutMs ?? 8_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function getJson(url: string): Promise<unknown | "unavailable"> {
    try {
      const response = await input.fetchImpl(url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return "unavailable";
      return await response.json();
    } catch {
      return "unavailable";
    }
  }

  return {
    async listOrganization({ organizationId }) {
      const [authBody, locationBody, registerBody, membershipBody, accessBody] = await Promise.all([
        getJson(`${authRoot}/admin/users?page=1&per_page=200`),
        getJson(
          `${restRoot}/pos_staff_location_assignments?organization_id=eq.${encodeURIComponent(
            organizationId,
          )}&select=actor_id,location_id,role`,
        ),
        getJson(
          `${restRoot}/pos_staff_register_assignments?organization_id=eq.${encodeURIComponent(
            organizationId,
          )}&select=actor_id,location_id,register_id`,
        ),
        getJson(
          `${restRoot}/pos_organization_memberships?organization_id=eq.${encodeURIComponent(
            organizationId,
          )}&select=actor_id,control_role,status`,
        ),
        getJson(
          `${restRoot}/pos_staff_access_controls?organization_id=eq.${encodeURIComponent(
            organizationId,
          )}&select=actor_id,status`,
        ),
      ]);

      if (
        authBody === "unavailable" ||
        locationBody === "unavailable" ||
        registerBody === "unavailable" ||
        membershipBody === "unavailable" ||
        accessBody === "unavailable"
      ) {
        return "unavailable";
      }

      const authUsers = parseAuthUsers(authBody).filter(
        (user) => user.organizationId === organizationId,
      );
      const locationRows = Array.isArray(locationBody) ? locationBody : [];
      const registerRows = Array.isArray(registerBody) ? registerBody : [];
      const membershipRows = Array.isArray(membershipBody) ? membershipBody : [];
      const accessRows = Array.isArray(accessBody) ? accessBody : [];

      const actorIds = new Set<string>();
      authUsers.forEach((row) => actorIds.add(row.actorId));
      for (const row of locationRows) {
        if (isRecord(row) && typeof row.actor_id === "string") actorIds.add(row.actor_id);
      }
      for (const row of membershipRows) {
        if (isRecord(row) && typeof row.actor_id === "string") actorIds.add(row.actor_id);
      }

      return [...actorIds]
        .map((actorId) => {
          const auth = authUsers.find((row) => row.actorId === actorId);
          const membership = membershipRows.find(
            (row) => isRecord(row) && row.actor_id === actorId,
          );
          const controlRole =
            isRecord(membership) &&
            membership.status === "active" &&
            isOrganizationControlRole(membership.control_role)
              ? membership.control_role
              : null;
          const access = accessRows.find(
            (row) => isRecord(row) && row.actor_id === actorId,
          );
          const posAccessStatus =
            isRecord(access) && access.status === "disabled" ? "disabled" : "active";

          const locations: StaffAccessLocation[] = [];
          for (const row of locationRows) {
            if (!isRecord(row) || row.actor_id !== actorId) continue;
            if (typeof row.location_id !== "string" || !isStaffAssignmentRole(row.role)) continue;
            const registerIds = registerRows.flatMap((registerRow) => {
              if (
                !isRecord(registerRow) ||
                registerRow.actor_id !== actorId ||
                registerRow.location_id !== row.location_id ||
                typeof registerRow.register_id !== "string"
              ) {
                return [];
              }
              return [registerRow.register_id];
            });
            locations.push({
              locationId: row.location_id,
              role: row.role,
              registerIds,
            });
          }

          return {
            actorId,
            displayName: auth?.displayName ?? actorId,
            ...(auth?.email ? { email: auth.email } : {}),
            authStatus: auth?.authStatus ?? "disabled",
            posAccessStatus,
            controlRole,
            locations,
            ...(auth?.createdAt ? { createdAt: auth.createdAt } : {}),
            ...(auth?.lastSignInAt ? { lastSignInAt: auth.lastSignInAt } : {}),
          } satisfies StaffAccessRecord;
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
    },
  };
}

type ParsedAuthUser = {
  readonly actorId: string;
  readonly organizationId: string;
  readonly displayName: string;
  readonly email?: string;
  readonly authStatus: "active" | "disabled";
  readonly createdAt?: string;
  readonly lastSignInAt?: string;
};

function parseAuthUsers(value: unknown): ParsedAuthUser[] {
  if (!isRecord(value) || !Array.isArray(value.users)) return [];
  const rows: ParsedAuthUser[] = [];
  for (const item of value.users) {
    if (!isRecord(item)) continue;
    const appMetadata = isRecord(item.app_metadata) ? item.app_metadata : {};
    const userMetadata = isRecord(item.user_metadata) ? item.user_metadata : {};
    const actorId = typeof appMetadata.actor_id === "string" ? appMetadata.actor_id : null;
    const organizationId =
      typeof appMetadata.organization_id === "string"
        ? appMetadata.organization_id
        : null;
    if (!actorId || !organizationId) continue;

    const bannedUntil =
      typeof item.banned_until === "string" ? Date.parse(item.banned_until) : Number.NaN;
    const deleted = item.deleted_at !== null && item.deleted_at !== undefined;
    const disabled = deleted || (!Number.isNaN(bannedUntil) && bannedUntil > Date.now());
    const displayName =
      typeof userMetadata.display_name === "string" && userMetadata.display_name.length > 0
        ? userMetadata.display_name
        : typeof item.email === "string"
          ? item.email
          : actorId;

    rows.push({
      actorId,
      organizationId,
      displayName,
      ...(typeof item.email === "string" ? { email: item.email } : {}),
      authStatus: disabled ? "disabled" : "active",
      ...(typeof item.created_at === "string" ? { createdAt: item.created_at } : {}),
      ...(typeof item.last_sign_in_at === "string"
        ? { lastSignInAt: item.last_sign_in_at }
        : {}),
    });
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
