import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch } from "../http/server-fetch";
import {
  createMemoryCashCorrectionAdminStore,
  createSupabaseCashCorrectionAdminStore,
  type CashCorrectionAdminStore,
} from "./cash-correction-admin-store";

export function composeCashCorrectionAdminStore(
  env: Readonly<Record<string, string | undefined>> = process.env,
): CashCorrectionAdminStore {
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const appEnv = env.APP_ENV ?? "local";
  if (infrastructure) {
    return createSupabaseCashCorrectionAdminStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl: createServerRestFetch(),
    });
  }
  if (appEnv === "staging" || appEnv === "production") {
    throw new Error("durable cash correction store is required");
  }
  return createMemoryCashCorrectionAdminStore();
}
