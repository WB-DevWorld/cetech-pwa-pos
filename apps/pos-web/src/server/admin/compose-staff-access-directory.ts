import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryStaffAccessDirectory,
  createSupabaseStaffAccessDirectory,
  type StaffAccessDirectory,
} from "./staff-access-directory";

export function composeStaffAccessDirectory(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StaffAccessDirectory {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseStaffAccessDirectory({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable staff access directory is required");
  }
  return createMemoryStaffAccessDirectory([]);
}
