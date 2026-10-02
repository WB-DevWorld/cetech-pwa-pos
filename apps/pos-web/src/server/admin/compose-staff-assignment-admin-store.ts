import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryStaffAssignmentAdminStore,
  createSupabaseStaffAssignmentAdminStore,
  type StaffAssignmentAdminStore,
} from "./staff-assignment-admin-store";

export function composeStaffAssignmentAdminStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
): StaffAssignmentAdminStore {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseStaffAssignmentAdminStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable staff assignment admin store is required");
  }
  return createMemoryStaffAssignmentAdminStore();
}
