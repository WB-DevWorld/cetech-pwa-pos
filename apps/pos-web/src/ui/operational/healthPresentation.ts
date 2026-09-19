import type { HealthCheck, StoreHealth } from "../../../../../docs/contracts/domain.generated";
import type { CatalogProjectionAvailability } from "../../local/catalog-sync";
import { describeHealthCheckMessage, healthCheckLabel } from "../cashier-language";

export type HealthRowTone = "ok" | "degraded" | "unavailable" | "unverified";

export type HealthRowView = {
  readonly id: string;
  readonly name: string;
  readonly detail: string;
  readonly tone: HealthRowTone;
  readonly badge: string;
};

function checkById(checks: readonly HealthCheck[], id: string): HealthCheck | undefined {
  return checks.find((check) => check.id === id);
}

function toneFromStatus(status: HealthCheck["status"]): HealthRowTone {
  if (status === "healthy") return "ok";
  if (status === "degraded") return "degraded";
  if (status === "unavailable") return "unavailable";
  return "unverified";
}

function badgeFromTone(tone: HealthRowTone): string {
  if (tone === "ok") return "OK";
  if (tone === "degraded") return "Degraded";
  if (tone === "unavailable") return "Unavailable";
  return "Unverified";
}

function catalogRow(availability: CatalogProjectionAvailability | null | undefined): HealthRowView {
  if (availability === "unavailable") {
    return { id: "catalog", name: "Catalog projection", detail: "Unavailable", tone: "unavailable", badge: "Unavailable" };
  }
  if (availability === "stale") {
    return { id: "catalog", name: "Catalog projection", detail: "Out of date", tone: "degraded", badge: "Degraded" };
  }
  if (availability === "fresh") {
    return { id: "catalog", name: "Catalog projection", detail: "Fresh", tone: "ok", badge: "OK" };
  }
  return { id: "catalog", name: "Catalog projection", detail: "Not verified yet", tone: "unverified", badge: "Unverified" };
}

function fromCheck(check: HealthCheck | undefined, fallbackId: string, fallbackName: string): HealthRowView {
  if (!check) {
    return { id: fallbackId, name: fallbackName, detail: "Not verified yet", tone: "unverified", badge: "Unverified" };
  }
  const tone = toneFromStatus(check.status);
  return {
    id: check.id,
    name: healthCheckLabel(check.id) === check.id.replaceAll("-", " ") ? fallbackName : healthCheckLabel(check.id),
    detail: describeHealthCheckMessage(check.id, check.message, check.status),
    tone,
    badge: badgeFromTone(tone),
  };
}

export function presentHealthRows(input: {
  readonly online: boolean;
  readonly health?: StoreHealth;
  readonly catalogAvailability?: CatalogProjectionAvailability | null;
  readonly electronicPaymentsAvailable?: boolean;
}): readonly HealthRowView[] {
  const checks = input.health?.checks ?? [];
  const commerce = checkById(checks, "commerce") ?? checkById(checks, "bridge");
  const pricing = checkById(checks, "pricing") ?? checkById(checks, "bridge-contract");
  const local = checkById(checks, "supabase");
  const internet: HealthRowView = input.online
    ? { id: "internet", name: "Internet", detail: "Connected", tone: "ok", badge: "OK" }
    : { id: "internet", name: "Internet", detail: "Offline", tone: "unavailable", badge: "Unavailable" };
  const payments: HealthRowView = input.electronicPaymentsAvailable
    ? { id: "payments", name: "Payments", detail: "Available", tone: "ok", badge: "OK" }
    : {
        id: "payments",
        name: "Payments",
        detail: "Cash can be taken. Electronic methods are not confirmed.",
        tone: "unverified",
        badge: "Unverified",
      };
  const appVersion: HealthRowView = input.health?.buildId
    ? { id: "app-version", name: "App version", detail: "Supported", tone: "ok", badge: "OK" }
    : { id: "app-version", name: "App version", detail: "Not verified yet", tone: "unverified", badge: "Unverified" };

  return [
    internet,
    {
      ...fromCheck(commerce, "commerce", "Commerce runtime"),
      name: "Commerce runtime",
      detail: commerce?.status === "healthy" ? "Healthy" : fromCheck(commerce, "commerce", "Commerce runtime").detail,
    },
    {
      ...fromCheck(pricing, "pricing", "Authoritative pricing"),
      name: "Authoritative pricing",
      detail:
        pricing?.status === "healthy"
          ? "Available"
          : fromCheck(pricing, "pricing", "Authoritative pricing").detail,
    },
    catalogRow(input.catalogAvailability),
    payments,
    {
      ...fromCheck(local, "supabase", "Local data"),
      name: "Local data",
      detail: local?.status === "healthy" ? "Healthy" : fromCheck(local, "supabase", "Local data").detail,
    },
    appVersion,
  ];
}
