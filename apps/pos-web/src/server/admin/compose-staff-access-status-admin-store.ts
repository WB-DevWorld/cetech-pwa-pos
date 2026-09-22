import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryStaffAccessStatusAdminStore,
  createSupabaseStaffAccessStatusAdminStore,
  type StaffAccessStatusAdminStore,
} from "./staff-access-status-admin-store";

export function composeStaffAccessStatusAdminStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StaffAccessStatusAdminStore {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseStaffAccessStatusAdminStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable staff access-status admin store is required");
  }
  return createMemoryStaffAccessStatusAdminStore();
}
