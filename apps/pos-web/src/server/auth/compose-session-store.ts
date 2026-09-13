import { readSupabaseInfrastructureEnv } from "../../config/env";
import type { PosRestFetch } from "../http/server-fetch";
import {
  getEphemeralDevStaffSessionStore,
  type StaffSessionStore,
} from "./session-store";
import { createSupabaseStaffSessionStore } from "./supabase-session-store";

/**
 * Staging/production must use the durable store. Local may use process memory
 * when no infrastructure env is attached. The ephemeral guard is not weakened.
 */
export function composeStaffSessionStore(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl?: PosRestFetch,
): StaffSessionStore {
  const appEnv = env.APP_ENV ?? "local";
  const infrastructure = readSupabaseInfrastructureEnv(env);
  if (appEnv === "production" || appEnv === "staging") {
    if (!infrastructure || !fetchImpl) {
      throw new Error("durable staff session store is required for staging/production");
    }
    return createSupabaseStaffSessionStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl,
    });
  }
  if (infrastructure && fetchImpl) {
    return createSupabaseStaffSessionStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl,
    });
  }
  return getEphemeralDevStaffSessionStore(env);
}
