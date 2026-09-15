import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import type { CheckoutStore, FaultInjectingCheckoutStore } from "../../core/checkout/types";
import type { SalesPort } from "../../../../../docs/contracts/ports";
import { readSupabaseInfrastructureEnv } from "../../config/env";
import type { PosRestFetch } from "../http/server-fetch";
import { composeSalesBridge } from "./compose-sales-bridge";
import { createMockSalesPort, createQuoteSnapshotSalesPort, type MockSalesPort } from "./mock-sales-port";
import { createSupabaseCheckoutStore } from "./supabase-checkout-store";

export type CheckoutSalesPort = Pick<SalesPort, "prepare" | "resolve" | "confirmPayment">;

export type CheckoutRuntime = {
  readonly store: FaultInjectingCheckoutStore;
  readonly salesPort: MockSalesPort;
};

let processMemoryRuntime:
  | {
      readonly store: CheckoutStore;
      readonly salesPort: CheckoutSalesPort;
    }
  | undefined;

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
  };
}

function salesPortFor(
  env: Readonly<Record<string, string | undefined>>,
  store: CheckoutStore,
  fetchImpl: PosRestFetch | undefined,
): CheckoutSalesPort {
  return composeSalesBridge(env, fetchImpl) ?? createQuoteSnapshotSalesPort(store);
}

/**
 * Staging/production require the durable Supabase checkout store and a server
 * fetch. Local may use process memory when infrastructure is absent. Configured
 * local Supabase infrastructure prefers the durable adapter. Never fall back to
 * memory in staging/production.
 */
export function composeCheckoutRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl?: PosRestFetch,
): {
  readonly store: CheckoutStore;
  readonly salesPort: CheckoutSalesPort;
} {
  const appEnv = env.APP_ENV ?? "local";
  const infrastructure = readSupabaseInfrastructureEnv(env);
  if (appEnv === "production" || appEnv === "staging") {
    if (!infrastructure || !fetchImpl) {
      throw new Error("durable checkout store is required for staging/production");
    }
    const store = createSupabaseCheckoutStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl,
    });
    return { store, salesPort: salesPortFor(env, store, fetchImpl) };
  }
  if (infrastructure && fetchImpl) {
    const store = createSupabaseCheckoutStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl,
    });
    return { store, salesPort: salesPortFor(env, store, fetchImpl) };
  }
  assertEphemeralCheckoutStoreAllowed(env);
  if (env === process.env) {
    processMemoryRuntime ??= (() => {
      const store = createInMemoryCheckoutStore();
      return { store, salesPort: salesPortFor(env, store, fetchImpl) };
    })();
    return processMemoryRuntime;
  }
  const store = createInMemoryCheckoutStore();
  return { store, salesPort: salesPortFor(env, store, fetchImpl) };
}

export type { MockSalesPort };
