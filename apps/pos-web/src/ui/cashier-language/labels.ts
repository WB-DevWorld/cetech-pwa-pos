export function skuLabel(sku: string | undefined): string | undefined {
  if (!sku?.trim()) return undefined;
  const trimmed = sku.trim();
  return /^sku\b/i.test(trimmed) ? trimmed : `SKU ${trimmed}`;
}

export function isUuidLike(value: string | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

export function friendlyDeviceName(name: string | undefined): string {
  if (!name?.trim() || isUuidLike(name)) return "This device";
  return name.trim();
}

export function orderStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "refunded":
      return "Refunded";
    case "partially_refunded":
      return "Partially refunded";
    case "payment_pending":
    case "pending":
      return "Pending";
    case "needs_attention":
    case "requires_attention":
      return "Needs review";
    case "cancelled":
      return "Cancelled";
    case "verified":
      return "Verified";
    case "failed":
      return "Failed";
    default:
      return status.replaceAll("_", " ");
  }
}

export function paymentStatusLabel(status: string): string {
  return orderStatusLabel(status);
}

export function healthCheckLabel(id: string): string {
  switch (id) {
    case "supabase":
      return "POS data";
    case "bridge":
    case "commerce":
      return "Commerce connection";
    case "bridge-contract":
    case "pricing":
      return "Pricing verification";
    case "payments":
      return "Payments";
    case "internet":
      return "Internet";
    case "catalog":
      return "Catalog projection";
    case "app-version":
      return "App version";
    default:
      return id.replaceAll("-", " ").replaceAll("_", " ");
  }
}

export const KEYBOARD_SCANNER_CAPABILITY = "Keyboard-wedge scanner";
export const BROWSER_PRINT_CAPABILITY = "Browser print (80mm/A4)";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"] as const;

export function formatOperationalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = date.getDate();
  const month = MONTHS[date.getMonth()] ?? "";
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

export function formatMoneyLabel(value: { readonly minor: number; readonly currency: string }): string {
  const amount = value.minor / 100;
  const currency = value.currency === "GHS" ? "GHS" : value.currency;
  return `${currency} ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function paymentTenderLabel(tender: string): string {
  switch (tender) {
    case "cash":
      return "Cash";
    case "mobile_money":
      return "Mobile Money";
    case "card":
      return "Card";
    case "external_electronic":
      return "Electronic";
    default:
      return tender.replaceAll("_", " ");
  }
}

export function scannerCapabilityLabel(label?: string): string {
  void label;
  return KEYBOARD_SCANNER_CAPABILITY;
}

export function printerCapabilityLabel(label?: string): string {
  void label;
  return BROWSER_PRINT_CAPABILITY;
}

export function describeHealthCheckMessage(id: string, rawMessage: string, status: string): string {
  if (id === "bridge" || id === "commerce" || id === "bridge-contract" || id === "pricing") {
    if (/pricingParityVerified=true/i.test(rawMessage)) {
      return "Verified";
    }
    if (/pricingParityVerified=false/i.test(rawMessage) && (id === "bridge-contract" || id === "pricing")) {
      return "Pending verification";
    }
    if (status === "healthy") {
      return "Connected";
    }
    if (status === "degraded") {
      return "Needs attention";
    }
    if (status === "unavailable") {
      return "Not connected";
    }
    return "Pending verification";
  }
  if (status === "healthy") return "Connected";
  if (status === "degraded") return "Needs attention";
  if (status === "unavailable") return "Not connected";
  return "Not verified yet";
}

export function catalogRebuildCopy(input: {
  readonly phase: "idle" | "rebuilding" | "success" | "failure";
  readonly itemCount?: number;
  readonly message?: string;
}): string | undefined {
  if (input.phase === "rebuilding") return "Refreshing products…";
  if (input.phase === "success") {
    const count = input.itemCount ?? 0;
    return `Products updated — ${count} item${count === 1 ? "" : "s"} ready.`;
  }
  if (input.phase === "failure") {
    return "Products couldn't be refreshed. Check the connection and try again. Saved carts are kept.";
  }
  return undefined;
}
