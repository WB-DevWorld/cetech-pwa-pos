import type { CatalogAvailability, DraftStatusView } from "../state/sellView";

export function catalogAvailabilityCopy(availability: CatalogAvailability): { tone: "info" | "warning" | "danger"; title: string; body: string } | null {
  switch (availability) {
    case "fresh":
      return null;
    case "stale":
      return {
        tone: "warning",
        title: "Catalog may be out of date.",
        body: "Reconnect to refresh before checkout.",
      };
    case "offline":
      return {
        tone: "warning",
        title: "Offline.",
        body: "You can keep browsing and editing the cart. Connection is required to confirm pricing and complete this sale.",
      };
    case "offline_cached":
      return {
        tone: "info",
        title: "Offline.",
        body: "Cached catalog is available. Connection is required to confirm pricing and complete this sale.",
      };
    case "unavailable":
      return {
        tone: "danger",
        title: "Catalog is unavailable.",
        body: "Reconnect or try again.",
      };
    default:
      return null;
  }
}

export function CatalogStatusBanners({
  availability,
  draftStatus,
}: {
  availability: CatalogAvailability;
  draftStatus: DraftStatusView;
}) {
  const catalog = catalogAvailabilityCopy(availability);
  return (
    <div className="sell-status-stack">
      {catalog ? (
        <div className={`banner ${catalog.tone}`} role="status">
          <div>
            <strong>{catalog.title}</strong> {catalog.body}
          </div>
        </div>
      ) : null}
      {draftStatus.retainedLocally ? (
        <div className="banner info" role="status">
          <div>
            <strong>Cart draft is saved on this device.</strong>
          </div>
        </div>
      ) : null}
    </div>
  );
}
