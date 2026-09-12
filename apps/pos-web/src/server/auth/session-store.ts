import type { Session } from "../../../../../docs/contracts/domain.generated";

export type StoredStaffSession = {
  readonly session: Session;
  readonly csrfToken: string;
  readonly expiresAt: Date;
};

export interface StaffSessionStore {
  create(session: Session, csrfToken: string, expiresAt: Date): Promise<string>;
  get(sessionId: string, now: Date): Promise<StoredStaffSession | null>;
  revoke(sessionId: string): Promise<void>;
}

export function createMemoryStaffSessionStore(): StaffSessionStore {
  const rows = new Map<string, StoredStaffSession>();
  return {
    async create(session, csrfToken, expiresAt) {
      const sessionId = crypto.randomUUID();
      rows.set(sessionId, { session, csrfToken, expiresAt });
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
  };
}

const defaultStaffSessionStore = createMemoryStaffSessionStore();

export function getDefaultStaffSessionStore(): StaffSessionStore {
  return defaultStaffSessionStore;
}
