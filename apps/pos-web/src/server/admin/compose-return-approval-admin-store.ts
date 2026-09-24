import { readSupabaseInfrastructureEnv } from "../../config/env";
import type { ReturnStore } from "../../core/returns/types";
import { createServerRestFetch } from "../http/server-fetch";
import type { AdminAuditStore } from "./admin-audit-store";
import {
  createMemoryReturnApprovalAdminStore,
  createSupabaseReturnApprovalAdminStore,
  type ReturnApprovalAdminStore,
} from "./return-approval-admin-store";

export function composeReturnApprovalAdminStore(input: {
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly returns: ReturnStore;
  readonly audit: AdminAuditStore;
}): ReturnApprovalAdminStore {
  const env = input.env ?? process.env;
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseReturnApprovalAdminStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable return approval store is required");
  }
  return createMemoryReturnApprovalAdminStore({
    returns: input.returns,
    audit: input.audit,
  });
}
