import { createInMemoryReturnStore } from "../../core/returns/in-memory-store";
import type { ReturnStore } from "../../core/returns/types";
import type { PosRestFetch } from "../http/server-fetch";
import { createSupabaseReturnStore } from "./supabase-return-store";

export function composeReturnStore(input: {
  readonly url?: string;
  readonly serviceRoleKey?: string;
  readonly fetchImpl: PosRestFetch;
  readonly allowEphemeral: boolean;
}): ReturnStore {
  if (input.url && input.serviceRoleKey) {
    return createSupabaseReturnStore({
      url: input.url,
      serviceRoleKey: input.serviceRoleKey,
      fetchImpl: input.fetchImpl,
    });
  }
  if (!input.allowEphemeral) {
    throw new Error("durable return store is required");
  }
  return createInMemoryReturnStore();
}
