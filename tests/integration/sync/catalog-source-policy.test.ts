import { describe, expect, test } from "vitest";
import {
  catalogSourcePolicyAllowsSynthetic,
  resolveBrowserCatalogSourcePolicy,
  resolveCatalogSourcePolicy,
} from "../../../apps/pos-web/src/core/catalog/source-policy";

describe("STG-04 catalog source policy", () => {
  test("local, test, and demo may use the synthetic cashier seed", () => {
    expect(resolveCatalogSourcePolicy("local")).toBe("synthetic_permitted");
    expect(resolveCatalogSourcePolicy("test")).toBe("synthetic_permitted");
    expect(resolveCatalogSourcePolicy("demo")).toBe("synthetic_permitted");
    expect(resolveCatalogSourcePolicy(undefined)).toBe("synthetic_permitted");
    expect(catalogSourcePolicyAllowsSynthetic("synthetic_permitted")).toBe(true);
  });

  test("staging and production-intent require a provider projection", () => {
    expect(resolveCatalogSourcePolicy("staging")).toBe("provider_required");
    expect(resolveCatalogSourcePolicy("production")).toBe("provider_required");
    expect(catalogSourcePolicyAllowsSynthetic("provider_required")).toBe(false);
  });

  test("browser policy treats localhost as local and other hosts as production-intent", () => {
    expect(resolveBrowserCatalogSourcePolicy({ hostname: "localhost" })).toBe("synthetic_permitted");
    expect(resolveBrowserCatalogSourcePolicy({ hostname: "127.0.0.1" })).toBe("synthetic_permitted");
    expect(resolveBrowserCatalogSourcePolicy({ nodeEnv: "test" })).toBe("synthetic_permitted");
    expect(resolveBrowserCatalogSourcePolicy({ hostname: "pos-staging.cetechbpa.com" })).toBe(
      "provider_required",
    );
    expect(resolveBrowserCatalogSourcePolicy({ appEnv: "staging", hostname: "localhost" })).toBe(
      "provider_required",
    );
  });
});
