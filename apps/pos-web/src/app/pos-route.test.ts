import { describe, expect, test } from "vitest";
import { posRouteFromPathname, returnSelectionHref } from "./pos-route";

describe("posRouteFromPathname", () => {
  test("maps mounted POS hrefs and the root sell alias", () => {
    expect(posRouteFromPathname("/")).toBe("sell");
    expect(posRouteFromPathname("/sell")).toBe("sell");
    expect(posRouteFromPathname("/orders/")).toBe("orders");
    expect(posRouteFromPathname("/customers")).toBe("customers");
    expect(posRouteFromPathname("/returns")).toBe("returns");
    expect(posRouteFromPathname("/register")).toBe("register");
    expect(posRouteFromPathname("/health")).toBe("health");
    expect(posRouteFromPathname("/attention")).toBe("attention");
    expect(posRouteFromPathname("/settings")).toBe("settings");
  });

  test("does not claim unknown paths as a POS workspace", () => {
    expect(posRouteFromPathname("/api/pos/v1/session")).toBeNull();
    expect(posRouteFromPathname("/missing")).toBeNull();
    expect(posRouteFromPathname(null)).toBeNull();
    expect(posRouteFromPathname(undefined)).toBeNull();
  });
});

describe("return selection href", () => {
  test("persists the selected sale identity in the Returns URL", () => {
    expect(returnSelectionHref("sale/24091")).toBe("/returns?sale=sale%2F24091");
  });
});
