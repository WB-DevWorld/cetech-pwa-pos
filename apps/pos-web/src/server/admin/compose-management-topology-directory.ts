import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryManagementTopologyDirectory,
  createSupabaseManagementTopologyDirectory,
  type ManagementTopologyDirectory,
} from "./management-topology-directory";

export function composeManagementTopologyDirectory(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ManagementTopologyDirectory {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseManagementTopologyDirectory({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable management topology directory is required");
  }
  return createMemoryManagementTopologyDirectory([]);
}
