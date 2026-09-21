import { POS_ROUTE_HREFS, type PosRoute } from "../ui/shell";

const HREF_TO_ROUTE = new Map<string, PosRoute>(
  (Object.entries(POS_ROUTE_HREFS) as Array<[PosRoute, string]>).map(([route, href]) => [href, route]),
);

export function posRouteFromPathname(pathname: string | null | undefined): PosRoute | null {
  if (!pathname) {
    return null;
  }
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/") {
    return "sell";
  }
  return HREF_TO_ROUTE.get(normalized) ?? null;
}

export function returnSelectionHref(saleId: string): string {
  return `${POS_ROUTE_HREFS.returns}?sale=${encodeURIComponent(saleId)}`;
}
