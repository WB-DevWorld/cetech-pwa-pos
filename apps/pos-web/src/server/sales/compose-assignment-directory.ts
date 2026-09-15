import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createMemoryAssignmentDirectory, type StaffAssignmentDirectory } from "../auth/assignments";
import { createSupabaseStaffAssignmentDirectory } from "../auth/supabase-assignment-directory";
import type { PosRestFetch } from "../http/server-fetch";

let processDirectory: StaffAssignmentDirectory | undefined;

export function assertEphemeralAssignmentDirectoryAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const appEnv = env.APP_ENV ?? "local";
  if (appEnv === "production" || appEnv === "staging") {
    throw new Error("ephemeral in-memory assignment directory is not a durable production runtime");
  }
}

/**
 * Staging/production require the durable assignment directory. Local may use
 * empty process memory when infrastructure is intentionally absent. Configured
 * local Supabase infrastructure prefers the durable adapter.
 */
export function composeStaffAssignmentDirectory(
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl?: PosRestFetch,
): StaffAssignmentDirectory {
  const appEnv = env.APP_ENV ?? "local";
  const infrastructure = readSupabaseInfrastructureEnv(env);
  if (appEnv === "production" || appEnv === "staging") {
    if (!infrastructure || !fetchImpl) {
      throw new Error("durable staff assignment directory is required for staging/production");
    }
    return createSupabaseStaffAssignmentDirectory({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl,
    });
  }
  if (infrastructure && fetchImpl) {
    return createSupabaseStaffAssignmentDirectory({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl,
    });
  }
  assertEphemeralAssignmentDirectoryAllowed(env);
  if (env === process.env) {
    processDirectory ??= createMemoryAssignmentDirectory([]);
    return processDirectory;
  }
  return createMemoryAssignmentDirectory([]);
}
