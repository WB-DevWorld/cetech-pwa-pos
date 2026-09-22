import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryAdminAuditDirectory,
  createSupabaseAdminAuditDirectory,
  type AdminAuditDirectory,
} from "./admin-audit-directory";

export function composeAdminAuditDirectory(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AdminAuditDirectory {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseAdminAuditDirectory({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable admin audit directory is required");
  }
  return createMemoryAdminAuditDirectory();
}
