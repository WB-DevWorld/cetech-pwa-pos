import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import type { CheckoutStore } from "../../core/checkout/types";
import type { SalesPort } from "../../../../../docs/contracts/ports";
import { createServerRestFetch } from "../http/server-fetch";
import { composeSalesBridge } from "./compose-sales-bridge";
import { createMockSalesPort, createQuoteSnapshotSalesPort, type MockSalesPort } from "./mock-sales-port";

export type CheckoutSalesPort = Pick<SalesPort, "prepare" | "resolve" | "confirmPayment">;

export type CheckoutRuntime = {
  readonly store: CheckoutStore;
  readonly salesPort: MockSalesPort;
};

let processRuntime:
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

/**
 * Local/dev process memory until a durable POS sale/payment/receipt adapter exists.
 * Staging/production must not select this store.
 * A configured bridge identity selects the BR-06/BR-07 HTTP adapter; otherwise the local mock.
 */
export function composeCheckoutRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
): {
  readonly store: CheckoutStore;
  readonly salesPort: CheckoutSalesPort;
} {
  assertEphemeralCheckoutStoreAllowed(env);
  if (!processRuntime) {
    const store = createInMemoryCheckoutStore();
    processRuntime = {
      store,
      salesPort: composeSalesBridge(env, createServerRestFetch()) ?? createQuoteSnapshotSalesPort(store),
    };
  }
  return processRuntime;
}

export type { MockSalesPort };
