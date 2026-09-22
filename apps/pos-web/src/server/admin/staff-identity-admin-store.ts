import type { PosRestFetch } from "../http/server-fetch";

export type InvitedStaffIdentity = {
  readonly authUserId: string;
  readonly actorId: string;
  readonly organizationId: string;
  readonly email: string;
  readonly displayName: string;
};

export interface StaffIdentityAdminStore {
  invite(input: {
    readonly organizationId: string;
    readonly email: string;
    readonly displayName: string;
    readonly actorId?: string;
  }): Promise<InvitedStaffIdentity | "conflict" | "unavailable">;
  suspendAuthUser(authUserId: string): Promise<"ok" | "unavailable">;
}

export function createMemoryStaffIdentityAdminStore(): StaffIdentityAdminStore & {
  readonly rows: InvitedStaffIdentity[];
} {
  const rows: InvitedStaffIdentity[] = [];
  return {
    rows,
    async invite(input) {
      if (rows.some((row) => row.email.toLowerCase() === input.email.toLowerCase())) {
        return "conflict";
      }
      const row: InvitedStaffIdentity = {
        authUserId: crypto.randomUUID(),
        actorId: input.actorId ?? crypto.randomUUID(),
        organizationId: input.organizationId,
        email: input.email,
        displayName: input.displayName,
      };
      rows.push(row);
      return row;
    },
    async suspendAuthUser() {
      return "ok";
    },
  };
}

export function createSupabaseStaffIdentityAdminStore(input: {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl: PosRestFetch;
  readonly timeoutMs?: number;
}): StaffIdentityAdminStore {
  const base = input.url.replace(/\/+$/, "");
  const timeoutMs = input.timeoutMs ?? 8_000;
  const headers = {
    apikey: input.serviceRoleKey,
    Authorization: `Bearer ${input.serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function request(url: string, method: string, body?: unknown) {
    try {
      const response = await input.fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      let json: unknown = null;
      try {
        json = await response.json();
      } catch {
        json = null;
      }
      return { ok: response.ok, status: response.status, body: json };
    } catch {
      return { ok: false, status: 0, body: null };
    }
  }

  async function suspendAuthUser(authUserId: string): Promise<"ok" | "unavailable"> {
    const result = await request(
      `${base}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`,
      "PUT",
      { ban_duration: "876000h" },
    );
    return result.ok ? "ok" : "unavailable";
  }

  return {
    async invite(value) {
      const invited = await request(
        `${base}/auth/v1/invite`,
        "POST",
        {
          email: value.email,
          data: { display_name: value.displayName },
        },
      );
      if (invited.status === 422 || invited.status === 409) return "conflict";
      if (!invited.ok) return "unavailable";

      const user = extractUser(invited.body);
      if (!user) return "unavailable";
      const actorId = value.actorId ?? crypto.randomUUID();
      const existingAppMetadata =
        user.app_metadata && typeof user.app_metadata === "object" && !Array.isArray(user.app_metadata)
          ? user.app_metadata as Record<string, unknown>
          : {};

      const updated = await request(
        `${base}/auth/v1/admin/users/${encodeURIComponent(user.id)}`,
        "PUT",
        {
          app_metadata: {
            ...existingAppMetadata,
            actor_id: actorId,
            organization_id: value.organizationId,
            location_ids: [],
            capabilities: [],
          },
          user_metadata: {
            display_name: value.displayName,
          },
        },
      );
      if (!updated.ok) {
        await suspendAuthUser(user.id);
        return "unavailable";
      }

      return {
        authUserId: user.id,
        actorId,
        organizationId: value.organizationId,
        email: typeof user.email === "string" ? user.email : value.email,
        displayName: value.displayName,
      };
    },
    suspendAuthUser,
  };
}

function extractUser(value: unknown): {
  readonly id: string;
  readonly email?: string;
  readonly app_metadata?: unknown;
} | null {
  const candidate =
    value && typeof value === "object" && !Array.isArray(value)
      ? ("user" in (value as Record<string, unknown>)
          ? (value as Record<string, unknown>).user
          : value)
      : null;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const row = candidate as Record<string, unknown>;
  if (typeof row.id !== "string") return null;
  return {
    id: row.id,
    ...(typeof row.email === "string" ? { email: row.email } : {}),
    ...(row.app_metadata !== undefined ? { app_metadata: row.app_metadata } : {}),
  };
}
