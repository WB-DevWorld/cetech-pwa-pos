import type { BridgeReturnEffectsPort } from "../../../../../docs/contracts/ports";
import { readSupabaseInfrastructureEnv } from "../../config/env";
import type { ReturnStore } from "../../core/returns/types";
import type { PosRestFetch } from "../http/server-fetch";
import { createPaystackElectronicRefundProvider } from "../payments/paystack-refund";
import type { ElectronicRefundProvider } from "../payments/refund-provider";
import { assertEphemeralCheckoutStoreAllowed } from "../sales/compose-checkout-runtime";
import { composeReturnBridge } from "./compose-return-bridge";
import { composeReturnStore } from "./compose-return-store";
import { createFakeBridgeReturnEffects } from "./fake-bridge-return-effects";

export type ReturnRuntime = {
  readonly store: ReturnStore;
  readonly bridge: BridgeReturnEffectsPort;
  readonly refundProvider: ElectronicRefundProvider;
};

let processMemoryReturns: ReturnRuntime | undefined;

export function composeReturnRuntime(
  env: Readonly<Record<string, string | undefined>> = process.env,
  fetchImpl?: PosRestFetch,
): ReturnRuntime {
  const appEnv = env.APP_ENV ?? "local";
  const infrastructure = readSupabaseInfrastructureEnv(env);
  const allowEphemeral = appEnv !== "production" && appEnv !== "staging" && !infrastructure;
  const store = composeReturnStore({
    url: infrastructure?.url,
    serviceRoleKey: infrastructure?.serviceRoleKey,
    fetchImpl: fetchImpl ?? (async () => {
      throw new Error("return store fetch is required");
    }),
    allowEphemeral,
  });
  const httpBridge = composeReturnBridge(env, fetchImpl);
  if (!httpBridge && (appEnv === "production" || appEnv === "staging")) {
    throw new Error("return-effects bridge is required for staging/production");
  }
  if (!httpBridge) {
    assertEphemeralCheckoutStoreAllowed(env);
  }
  const refundProvider = createPaystackElectronicRefundProvider();
  if (env === process.env && allowEphemeral) {
    processMemoryReturns ??= {
      store,
      bridge: httpBridge ?? createFakeBridgeReturnEffects(crypto.randomUUID()),
      refundProvider,
    };
    return processMemoryReturns;
  }
  return {
    store,
    bridge: httpBridge ?? createFakeBridgeReturnEffects(crypto.randomUUID()),
    refundProvider,
  };
}
