import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryStaffAccessControl,
  createSupabaseStaffAccessControl,
  type StaffAccessControl,
} from "./staff-access-control";

export function composeStaffAccessControl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StaffAccessControl {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseStaffAccessControl({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable staff access control is required");
  }
  return createMemoryStaffAccessControl();
}
