import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryReceiptSettingsAdminStore,
  createSupabaseReceiptSettingsAdminStore,
  type ReceiptSettingsAdminStore,
} from "./receipt-settings-admin-store";

export function composeReceiptSettingsAdminStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ReceiptSettingsAdminStore {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseReceiptSettingsAdminStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable receipt settings admin store is required");
  }
  return createMemoryReceiptSettingsAdminStore();
}
