import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryAdminAuditStore,
  createSupabaseAdminAuditStore,
  type AdminAuditStore,
} from "./admin-audit-store";

export function composeAdminAuditStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AdminAuditStore {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseAdminAuditStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable admin audit store is required");
  }
  return createMemoryAdminAuditStore();
}
