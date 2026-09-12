import type { IdentityPort } from "../../../../../docs/contracts/ports";
import type { Session } from "../../../../../docs/contracts/domain.generated";
import { preserveLocalWorkOnSignOut, type LocalWorkStores } from "./local-work";

export type StaffSessionGateway = {
  read(): Promise<Session | null>;
  clear(): Promise<void>;
};

export type StaffIdentityPortOptions = {
  readonly gateway: StaffSessionGateway;
  readonly correlationId: () => string;
  readonly localWork?: LocalWorkStores;
};

/**
 * Browser IdentityPort. `can()` is a UI hint from the session capability list.
 * Server `authorizeStaffRead` / `authorizeStaffMutation` remain authoritative.
 * Client and JWT capability lists never grant access.
 */
export function createStaffIdentityPort(options: StaffIdentityPortOptions): IdentityPort & {
  readonly localWork?: LocalWorkStores;
} {
  return {
    localWork: options.localWork,
    async getSession() {
      const session = await options.gateway.read();
      if (!session) {
        return {
          ok: false,
          error: {
            code: "AUTH_REQUIRED",
            message: "staff session is not established",
            retryable: false,
            nextAction: "reauthenticate",
          },
          correlationId: options.correlationId(),
        };
      }
      return {
        ok: true,
        data: session,
        correlationId: options.correlationId(),
      };
    },
    async can(capability: string) {
      const session = await options.gateway.read();
      if (!session) {
        return false;
      }
      return session.capabilities.includes(capability);
    },
    async signOut() {
      await options.gateway.clear();
      if (options.localWork) {
        preserveLocalWorkOnSignOut(options.localWork);
      }
    },
  };
}
