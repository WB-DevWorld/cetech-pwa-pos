import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import { createMemoryControlPlaneDirectory, createSupabaseControlPlaneDirectory, type ControlPlaneDirectory } from "./control-plane-directory";

export function composeControlPlaneDirectory(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ControlPlaneDirectory {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseControlPlaneDirectory({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable management authority directory is required");
  }
  return createMemoryControlPlaneDirectory([]);
}
