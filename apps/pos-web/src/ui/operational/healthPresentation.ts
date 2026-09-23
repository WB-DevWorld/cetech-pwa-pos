import type { HealthCheck, StoreHealth } from "../../../../../docs/contracts/domain.generated";
import type { CatalogProjectionAvailability } from "../../local/catalog-sync";
import type { PaymentMethodCapabilities } from "../../server/payments/method-capabilities";
import { describeHealthCheckMessage } from "../cashier-language";

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

function paymentHealthRow(
  methods: PaymentMethodCapabilities | undefined,
  electronicPaymentsAvailable: boolean | undefined,
): HealthRowView {
  if (!methods) {
    return electronicPaymentsAvailable
      ? { id: "payments", name: "Payments", detail: "Available", tone: "ok", badge: "OK" }
      : { id: "payments", name: "Payments", detail: "Cash can be taken. Electronic methods are not confirmed.", tone: "unverified", badge: "Unverified" };
  }
  const configured = [
    methods.mobileMoney === "configured" ? "Mobile Money" : null,
    methods.card === "configured" ? "Card" : null,
    methods.externalTerminal === "configured" ? "External terminal" : null,
  ].filter((item): item is string => item !== null);
  if (configured.length > 0) {
    return {
      id: "payments",
      name: "Payments",
      detail: `Cash is available. ${configured.join(" and ")} ${configured.length === 1 ? "is" : "are"} set up.`,
      tone: "ok",
      badge: "OK",
    };
  }
  const unavailable = [methods.mobileMoney, methods.card, methods.externalTerminal].every(
    (item) => item === "unavailable",
  );
  return unavailable
    ? { id: "payments", name: "Payments", detail: "Cash can be taken. Electronic methods are unavailable.", tone: "unavailable", badge: "Unavailable" }
    : { id: "payments", name: "Payments", detail: "Cash can be taken. Electronic methods are not set up.", tone: "unverified", badge: "Unverified" };
}

function catalogRow(availability: CatalogProjectionAvailability | null | undefined): HealthRowView {
  if (availability === "unavailable") return { id: "catalog", name: "Products", detail: "Unavailable", tone: "unavailable", badge: "Unavailable" };
  if (availability === "stale") return { id: "catalog", name: "Products", detail: "May be out of date", tone: "degraded", badge: "Degraded" };
  if (availability === "fresh") return { id: "catalog", name: "Products", detail: "Ready", tone: "ok", badge: "OK" };
  return { id: "catalog", name: "Products", detail: "Not confirmed yet", tone: "unverified", badge: "Unverified" };
}

function fromCheck(check: HealthCheck | undefined, fallbackId: string, name: string): HealthRowView {
  if (!check) return { id: fallbackId, name, detail: "Not confirmed yet", tone: "unverified", badge: "Unverified" };
  const tone = toneFromStatus(check.status);
  return {
    id: check.id,
    name,
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
  readonly paymentMethods?: PaymentMethodCapabilities;
}): readonly HealthRowView[] {
  const checks = input.health?.checks ?? [];
  const commerce = checkById(checks, "commerce") ?? checkById(checks, "bridge");
  const pricing = checkById(checks, "pricing") ?? checkById(checks, "bridge-contract");
  const local = checkById(checks, "supabase");
  const internet: HealthRowView = input.online
    ? { id: "internet", name: "Internet", detail: "Connected", tone: "ok", badge: "OK" }
    : { id: "internet", name: "Internet", detail: "Offline", tone: "unavailable", badge: "Unavailable" };
  const payments = paymentHealthRow(input.paymentMethods, input.electronicPaymentsAvailable);

  return [
    internet,
    {
      ...fromCheck(commerce, "commerce", "Store connection"),
      name: "Store connection",
      detail: commerce?.status === "healthy" ? "Connected" : fromCheck(commerce, "commerce", "Store connection").detail,
    },
    {
      ...fromCheck(pricing, "pricing", "Prices"),
      name: "Prices",
      detail: pricing?.status === "healthy" ? "Available" : fromCheck(pricing, "pricing", "Prices").detail,
    },
    catalogRow(input.catalogAvailability),
    payments,
    {
      ...fromCheck(local, "supabase", "POS data"),
      name: "POS data",
      detail: local?.status === "healthy" ? "Ready" : fromCheck(local, "supabase", "POS data").detail,
    },
  ];
}
