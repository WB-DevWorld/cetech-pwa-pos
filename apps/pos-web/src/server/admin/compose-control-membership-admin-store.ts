import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryControlMembershipAdminStore,
  createSupabaseControlMembershipAdminStore,
  type ControlMembershipAdminStore,
} from "./control-membership-admin-store";

export function composeControlMembershipAdminStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ControlMembershipAdminStore {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseControlMembershipAdminStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable control-membership admin store is required");
  }
  return createMemoryControlMembershipAdminStore();
}
