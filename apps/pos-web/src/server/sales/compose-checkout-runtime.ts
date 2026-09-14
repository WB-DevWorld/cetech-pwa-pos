import { createInMemoryCheckoutStore } from "../../core/checkout/in-memory-store";
import type { CheckoutStore } from "../../core/checkout/types";
import { createMockSalesPort, type MockSalesPort } from "./mock-sales-port";

export type CheckoutRuntime = {
  readonly store: CheckoutStore;
  readonly salesPort: MockSalesPort;
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
  };
}

/**
 * Local/dev process memory until a durable POS sale/payment/receipt adapter exists.
 * Staging/production must not select this store.
 */
export function composeCheckoutRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
): CheckoutRuntime {
  assertEphemeralCheckoutStoreAllowed(env);
  processRuntime ??= createCheckoutRuntime();
  return processRuntime;
}
