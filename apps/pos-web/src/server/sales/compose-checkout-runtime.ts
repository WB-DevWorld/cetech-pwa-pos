import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import {
  createMemoryPrepareIntentStore,
  createMemoryQuoteSnapshotStore,
  createSupabaseCheckoutStore,
  createSupabasePrepareIntentStore,
  createSupabaseQuoteSnapshotStore,
  type PrepareIntentStore,
  type QuoteSnapshotStore,
} from "../../core/checkout/supabase-store";
import type { CheckoutStore } from "../../core/checkout/types";
import type { SalesPort } from "../../../../../docs/contracts/ports";
import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createServerRestFetch, type PosRestFetch } from "../http/server-fetch";
import { composeBridgeSalesPort } from "./bridge-sales-port";
import { createMockSalesPort } from "./mock-sales-port";

export type CheckoutRuntime = {
  readonly store: CheckoutStore;
  readonly salesPort: SalesPort;
  readonly quoteSnapshots: QuoteSnapshotStore;
  readonly prepareIntents: PrepareIntentStore;
  readonly durable: boolean;
};

let processRuntime: CheckoutRuntime | undefined;

export function assertEphemeralCheckoutStoreAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const appEnv = env.APP_ENV ?? "local";
  if (appEnv === "production" || appEnv === "staging") {
    throw new Error("ephemeral in-memory checkout store is not a durable production runtime");
  }
}

export function createCheckoutRuntime(): CheckoutRuntime {
  return {
    store: createInMemoryCheckoutStore(),
    salesPort: createMockSalesPort(),
    quoteSnapshots: createMemoryQuoteSnapshotStore(),
    prepareIntents: createMemoryPrepareIntentStore(),
    durable: false,
  };
}

/**
 * Local development keeps the deterministic in-memory harness unless explicitly
 * configured. Staging/production may only compose the durable Supabase store +
 * authenticated Woo bridge adapter; there is no silent mock fallback.
 */
export function composeCheckoutRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl: PosRestFetch = createServerRestFetch(),
): CheckoutRuntime {
  if (processRuntime) return processRuntime;

  const appEnv = env.APP_ENV ?? "local";
  const mustBeDurable = appEnv === "production" || appEnv === "staging" || env.POS_CHECKOUT_RUNTIME === "durable";
  if (!mustBeDurable) {
    assertEphemeralCheckoutStoreAllowed(env);
    processRuntime = createCheckoutRuntime();
    return processRuntime;
  }

  const supabase = readSupabaseInfrastructureEnv(env);
  const salesPort = composeBridgeSalesPort(env, fetchImpl);
  if (!supabase || !salesPort) {
    throw new Error("durable checkout runtime requires Supabase infrastructure and Woo bridge service configuration");
  }
  const options = {
    url: supabase.url,
    serviceRoleKey: supabase.serviceRoleKey,
    fetchImpl,
  };
  processRuntime = {
    store: createSupabaseCheckoutStore(options),
    salesPort,
    quoteSnapshots: createSupabaseQuoteSnapshotStore(options),
    prepareIntents: createSupabasePrepareIntentStore(options),
    durable: true,
  };
  return processRuntime;
}

/** Test-only process singleton reset. */
export function resetCheckoutRuntimeForTests(): void {
  processRuntime = undefined;
}
