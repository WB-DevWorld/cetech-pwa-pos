import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryOperationalPolicyStore,
  createSupabaseOperationalPolicyStore,
  type OperationalPolicyStore,
} from "./operational-policy-store";

export function composeOperationalPolicyStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
): OperationalPolicyStore {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseOperationalPolicyStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable operational policy store is required");
  }
  return createMemoryOperationalPolicyStore();
}
