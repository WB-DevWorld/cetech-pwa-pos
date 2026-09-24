import type { Session } from "../../../../../docs/contracts/domain.generated";

export type StaffSessionCreateFlags = {
  readonly mustChangePassword?: boolean;
  readonly authUserId?: string | null;
};

export type StoredStaffSession = {
  readonly session: Session;
  readonly csrfToken: string;
  readonly expiresAt: Date;
  readonly mustChangePassword?: boolean;
  readonly authUserId?: string | null;
};

/**
 * Durable-capable staff session port. Production must supply a provider-backed
 * implementation. Process memory is not that implementation.
 */
export interface StaffSessionStore {
  create(
    session: Session,
    csrfToken: string,
    expiresAt: Date,
    flags?: StaffSessionCreateFlags,
  ): Promise<string>;
  get(sessionId: string, now: Date): Promise<StoredStaffSession | null>;
  revoke(sessionId: string): Promise<void>;
  revokeActorSessions(input: {
    readonly organizationId: string;
    readonly actorId: string;
  }): Promise<void>;
}

/**
 * Test/dev-only process memory. Not durable across processes, serverless
 * instances, or restarts. Must not be selected as the production runtime store.
 */
export function createEphemeralInMemoryStaffSessionStore(): StaffSessionStore {
  const rows = new Map<string, StoredStaffSession>();
  return {
    async create(session, csrfToken, expiresAt, flags) {
      const sessionId = crypto.randomUUID();
      rows.set(sessionId, {
        session,
        csrfToken,
        expiresAt,
        mustChangePassword: flags?.mustChangePassword === true,
        authUserId: flags?.authUserId ?? null,
      });
      return sessionId;
    },
    async get(sessionId, now) {
      const row = rows.get(sessionId);
      if (!row) {
        return null;
      }
      if (row.expiresAt.getTime() <= now.getTime()) {
        rows.delete(sessionId);
        return null;
      }
      return row;
    },
    async revoke(sessionId) {
      rows.delete(sessionId);
    },
    async revokeActorSessions(input) {
      for (const [sessionId, row] of rows) {
        if (
          row.session.organizationId === input.organizationId &&
          row.session.actorId === input.actorId
        ) {
          rows.delete(sessionId);
        }
      }
    },
  };
}

const ephemeralDevStore = createEphemeralInMemoryStaffSessionStore();

export function assertEphemeralSessionStoreAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const appEnv = env.APP_ENV ?? "local";
  if (appEnv === "production" || appEnv === "staging") {
    throw new Error("ephemeral in-memory staff session store is not a durable production runtime");
  }
}

export function getEphemeralDevStaffSessionStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StaffSessionStore {
  assertEphemeralSessionStoreAllowed(env);
  return ephemeralDevStore;
}
