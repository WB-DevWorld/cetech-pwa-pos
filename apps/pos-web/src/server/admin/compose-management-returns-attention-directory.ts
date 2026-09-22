import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryManagementReturnsAttentionDirectory,
  createSupabaseManagementReturnsAttentionDirectory,
  type ManagementReturnsAttentionDirectory,
} from "./management-returns-attention-directory";

export function composeManagementReturnsAttentionDirectory(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ManagementReturnsAttentionDirectory {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseManagementReturnsAttentionDirectory({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable management returns attention directory is required");
  }
  return createMemoryManagementReturnsAttentionDirectory([]);
}
