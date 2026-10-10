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
      : {
          id: "payments",
          name: "Payments",
          detail: "Cash can be taken. Payment setup has not been confirmed yet.",
          tone: "unverified",
          badge: "Unverified",
        };
  }
  const manual =
    methods.manualMobileMoney === "enabled"
      ? "Manually confirmed Mobile Money is enabled."
      : "Manually confirmed Mobile Money is not set up.";
  const integrated = integratedCheckoutSentence(methods);
  const tone = paymentTone(methods);
  return {
    id: "payments",
    name: "Payments",
    detail: `Cash is available. ${manual} ${integrated}`,
    tone,
    badge: badgeFromTone(tone),
  };
}

function integratedCheckoutSentence(methods: PaymentMethodCapabilities): string {
  if (methods.integratedCheckout === "paystack_test") {
    const channels = [
      methods.card === "configured" ? "card" : null,
      methods.mobileMoney === "configured" ? "Paystack mobile money" : null,
    ].filter((item): item is string => item !== null);
    const channelText = channels.length > 0 ? ` for ${channels.join(" and ")}` : ", but no card or Paystack mobile-money channel is turned on";
    return `Paystack test checkout is configured${channelText}. It is not ready for live payments.`;
  }
  if (methods.integratedCheckout === "live_blocked") {
    return "Live electronic checkout is blocked in this version.";
  }
  if (methods.integratedCheckout === "unavailable") {
    return "Integrated electronic checkout is unavailable.";
  }
  if (methods.integratedCheckout === "not_verified") {
    return "Integrated electronic checkout has not been verified.";
  }
  return "Integrated electronic checkout is not set up.";
}

function paymentTone(methods: PaymentMethodCapabilities): HealthRowTone {
  if (methods.integratedCheckout === "live_blocked" || methods.integratedCheckout === "unavailable") return "unavailable";
  if (methods.integratedCheckout === "paystack_test" || methods.integratedCheckout === "not_verified") return "unverified";
  if (methods.manualMobileMoney === "enabled") return "ok";
  return "unverified";
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
  const dependencies = checkById(checks, "bridge-dependencies");
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
      ...fromCheck(dependencies, "bridge-dependencies", "Store services"),
      name: "Store services",
    },
    {
      ...fromCheck(pricing, "pricing", "Prices"),
      name: "Prices",
      detail:
        pricing?.status === "healthy"
          ? "Pricing qualification passed. It is separate from the quoted price on the current sale."
          : fromCheck(pricing, "pricing", "Prices").detail,
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
