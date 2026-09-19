import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { ReturnsScreen } from "./ReturnsScreen";
import { idleReturnSession, type HistoricReturnSaleView } from "./returnView";

const sale: HistoricReturnSaleView = {
  saleId: "sale-24091",
  orderReference: "#24091",
  currency: "GHS",
  customerLabel: "Accra Buildworks Ltd",
  createdAt: "2026-09-10T15:12:00.000Z",
  total: { minor: 115000, currency: "GHS" },
  itemSummary: "2 × Premium Interior Emulsion Paint 20L",
  lines: [{ orderLineId: "ol-1", name: "Premium Interior Emulsion Paint 20L", originalSoldQuantity: "2" }],
};

describe("Returns discovery", () => {
  test("renders search-first cards without entering ReturnFlow until a sale is selected", () => {
    const html = renderToStaticMarkup(
      createElement(ReturnsScreen, {
        session: idleReturnSession(),
        inFlight: false,
        lookup: { async search() { return [sale]; } },
        matches: [sale],
        onSelectSale: () => undefined,
        onUpdateLine: () => undefined,
        onPreview: () => undefined,
        onExecute: () => undefined,
        onResolve: () => undefined,
      }),
    );
    expect(html).toContain("Find order, customer or receipt");
    expect(html).toContain("#24091");
    expect(html).toContain("Accra Buildworks Ltd");
    expect(html).toContain("Return items");
    expect(html).not.toContain("Look up sale");
    expect(html).not.toContain("Original sale");
  });
});
