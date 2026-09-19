import type { Uuid } from "../../../../../docs/contracts/domain.generated";
import { readBridgeServiceEnv } from "../../config/env";
import { createBridgeServiceIdentity } from "../health/bridge-adapter";
import type { PosRestFetch } from "../http/server-fetch";
import type { CustomerReadItem } from "../../features/customers/customerRead";

export type { CustomerReadItem } from "../../features/customers/customerRead";

export type CustomerBridgePage = {
  readonly items: readonly CustomerReadItem[];
};

export type CustomerBridgeResult =
  | { readonly ok: true; readonly page: CustomerBridgePage; readonly correlationId: Uuid }
  | { readonly ok: false; readonly code: "INTEGRATION_UNAVAILABLE" | "VALIDATION_ERROR"; readonly message: string; readonly correlationId: Uuid };

export type CustomerBridge = {
  search(query: string, correlationId: Uuid): Promise<CustomerBridgeResult>;
};

export function customersUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/wp-json/cetech-pos/v1/customers")) {
    return trimmed;
  }
  if (trimmed.endsWith("/wp-json/cetech-pos/v1")) {
    return `${trimmed}/customers`;
  }
  return `${trimmed}/wp-json/cetech-pos/v1/customers`;
}

export function composeCustomerBridge(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: PosRestFetch | undefined,
): CustomerBridge | undefined {
  const identity = readBridgeServiceEnv(env);
  if (!identity || !fetchImpl) {
    return undefined;
  }
  const service = createBridgeServiceIdentity({
    username: identity.username,
    applicationPassword: identity.applicationPassword,
  });
  const url = customersUrl(identity.baseUrl);
  return {
    async search(query, correlationId) {
      const target = new URL(url);
      if (query.trim()) {
        target.searchParams.set("query", query.trim());
      }
      target.searchParams.set("limit", "50");
      try {
        const response = await fetchImpl(target.toString(), {
          method: "GET",
          headers: {
            authorization: service.authorizationHeader,
            accept: "application/json",
            "x-correlation-id": correlationId,
          },
        });
        let json: unknown;
        try {
          json = await response.json();
        } catch {
          return unavailable(correlationId);
        }
        if (!isRecord(json) || json.ok !== true || !isRecord(json.data) || !Array.isArray(json.data.items)) {
          return unavailable(correlationId);
        }
        const items = json.data.items.flatMap((row) => {
          const mapped = mapCustomer(row);
          return mapped ? [mapped] : [];
        });
        return { ok: true, page: { items }, correlationId };
      } catch {
        return unavailable(correlationId);
      }
    },
  };
}

function unavailable(correlationId: Uuid): CustomerBridgeResult {
  return {
    ok: false,
    code: "INTEGRATION_UNAVAILABLE",
    message: "customer producer is unavailable",
    correlationId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function mapCustomer(value: unknown): CustomerReadItem | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.displayName !== "string") {
    return undefined;
  }
  if (value.kind !== "retail" && value.kind !== "b2b") {
    return undefined;
  }
  return {
    id: value.id,
    kind: value.kind,
    displayName: value.displayName,
    company: typeof value.company === "string" ? value.company : undefined,
    phoneMasked: typeof value.phoneMasked === "string" ? value.phoneMasked : undefined,
    commercialContext: typeof value.commercialContext === "string" ? value.commercialContext : undefined,
  };
}
