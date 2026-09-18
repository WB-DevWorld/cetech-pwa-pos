import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import type { CheckoutStore, FaultInjectingCheckoutStore } from "../../core/checkout/types";
import { createMemoryCatalogPresentationLookup } from "../../core/receipt/catalog-presentation";
import type { CatalogPresentationLookup } from "../../core/receipt/catalog-presentation";
import { createMemoryReceiptSettingsStore } from "../../core/receipt/settings-store";
import type { ReceiptSettingsStore } from "../../core/receipt/settings-store";
import type { SalesPort } from "../../../../../docs/contracts/ports";
import { readSupabaseInfrastructureEnv } from "../../config/env";
import { createSupabaseCatalogPresentationLookup } from "../catalog/presentation-lookup";
import type { PosRestFetch } from "../http/server-fetch";
import { createSupabaseReceiptSettingsStore } from "../receipt/settings-store";
import { composeSalesBridge } from "./compose-sales-bridge";
import { createMockSalesPort, createQuoteSnapshotSalesPort, type MockSalesPort } from "./mock-sales-port";
import { createSupabaseCheckoutStore } from "./supabase-checkout-store";

export type CheckoutSalesPort = Pick<SalesPort, "prepare" | "resolve" | "confirmPayment">;

export type CheckoutPresentationRuntime = {
  readonly catalogLookup: CatalogPresentationLookup;
  readonly receiptSettings: ReceiptSettingsStore;
};

export type CheckoutRuntime = {
  readonly store: FaultInjectingCheckoutStore;
  readonly salesPort: MockSalesPort;
} & CheckoutPresentationRuntime;

let processMemoryRuntime:
  | {
      readonly store: CheckoutStore;
      readonly salesPort: CheckoutSalesPort;
    } & CheckoutPresentationRuntime
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
    catalogLookup: createMemoryCatalogPresentationLookup(),
    receiptSettings: createMemoryReceiptSettingsStore(),
  };
}

function presentationFor(
  infrastructure: { readonly url: string; readonly serviceRoleKey: string } | undefined,
  fetchImpl: PosRestFetch | undefined,
): CheckoutPresentationRuntime {
  if (infrastructure && fetchImpl) {
    return {
      catalogLookup: createSupabaseCatalogPresentationLookup({
        url: infrastructure.url,
        serviceRoleKey: infrastructure.serviceRoleKey,
        fetchImpl,
      }),
      receiptSettings: createSupabaseReceiptSettingsStore({
        url: infrastructure.url,
        serviceRoleKey: infrastructure.serviceRoleKey,
        fetchImpl,
      }),
    };
  }
  return {
    catalogLookup: createMemoryCatalogPresentationLookup(),
    receiptSettings: createMemoryReceiptSettingsStore(),
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
} & CheckoutPresentationRuntime {
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
    return {
      store,
      salesPort: salesPortFor(env, store, fetchImpl),
      ...presentationFor(infrastructure, fetchImpl),
    };
  }
  if (infrastructure && fetchImpl) {
    const store = createSupabaseCheckoutStore({
      url: infrastructure.url,
      serviceRoleKey: infrastructure.serviceRoleKey,
      fetchImpl,
    });
    return {
      store,
      salesPort: salesPortFor(env, store, fetchImpl),
      ...presentationFor(infrastructure, fetchImpl),
    };
  }
  assertEphemeralCheckoutStoreAllowed(env);
  if (env === process.env) {
    processMemoryRuntime ??= (() => {
      const store = createInMemoryCheckoutStore();
      return {
        store,
        salesPort: salesPortFor(env, store, fetchImpl),
        ...presentationFor(undefined, fetchImpl),
      };
    })();
    return processMemoryRuntime;
  }
  const store = createInMemoryCheckoutStore();
  return {
    store,
    salesPort: salesPortFor(env, store, fetchImpl),
    ...presentationFor(undefined, fetchImpl),
  };
}

export type { MockSalesPort };
