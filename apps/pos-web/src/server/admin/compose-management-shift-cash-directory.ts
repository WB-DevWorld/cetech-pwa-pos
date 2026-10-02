import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryManagementShiftCashDirectory,
  createSupabaseManagementShiftCashDirectory,
  type ManagementShiftCashDirectory,
} from "./management-shift-cash-directory";

export function composeManagementShiftCashDirectory(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ManagementShiftCashDirectory {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseManagementShiftCashDirectory({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable management shift cash directory is required");
  }
  return createMemoryManagementShiftCashDirectory([]);
}
