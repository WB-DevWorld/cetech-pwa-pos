import type { CatalogAvailability } from "../state/sellView";

export function catalogAvailabilityCopy(availability: CatalogAvailability): { tone: "info" | "warning" | "danger"; title: string; body: string } | null {
  switch (availability) {
    case "fresh":
      return null;
    case "stale":
      return {
        tone: "warning",
        title: "Products may be out of date.",
        body: "Refresh products before checkout.",
      };
    case "offline":
      return {
        tone: "warning",
        title: "Offline.",
        body: "You can keep browsing and editing the cart. A connection is required to check prices and complete this sale.",
      };
    case "offline_cached":
      return {
        tone: "info",
        title: "Offline.",
        body: "Saved products are available. A connection is required to check prices and complete this sale.",
      };
    case "unavailable":
      return {
        tone: "danger",
        title: "Products couldn't be loaded.",
        body: "Check the connection and try again.",
      };
    default:
      return null;
  }
}

export function CatalogStatusBanners({ availability }: { availability: CatalogAvailability }) {
  const catalog = catalogAvailabilityCopy(availability);
  if (!catalog) return null;
  return (
    <div className="sell-status-stack">
      <div className={`banner ${catalog.tone}`} role="status">
        <div>
          <strong>{catalog.title}</strong> {catalog.body}
        </div>
      </div>
    </div>
  );
}
