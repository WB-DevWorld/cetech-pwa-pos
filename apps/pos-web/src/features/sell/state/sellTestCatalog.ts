import type { CustomerSearchResultView, SellProductView } from "./sellView";

/** Presentation fixtures for FE-03 unit tests. Not a production catalog projection. */
export const SELL_TEST_CATALOG: readonly SellProductView[] = [
  {
    id: "p-leading-zero",
    name: "Leading-zero sample",
    sku: "LZ-001",
    barcodes: ["0012345"],
    kind: "simple",
    stockStatus: "in_stock",
  },
  {
    id: "p-hardener",
    name: "Epoxy Hardener 1L",
    sku: "HDN-1L",
    barcodes: ["0012345678901"],
    kind: "simple",
    stockStatus: "in_stock",
  },
  {
    id: "p-cable",
    name: "Armoured Cable",
    sku: "CBL-ARM",
    barcodes: ["0011223344556"],
    kind: "variable",
    stockStatus: "in_stock",
  },
  {
    id: "v-cable-red",
    name: "Armoured Cable",
    sku: "CBL-ARM-RED",
    barcodes: ["0001112223334"],
    kind: "variation",
    parentId: "p-cable",
    variationLabel: "Red",
    stockStatus: "in_stock",
  },
  {
    id: "v-cable-black",
    name: "Armoured Cable",
    sku: "CBL-ARM-BLK",
    barcodes: ["0001112223335"],
    kind: "variation",
    parentId: "p-cable",
    variationLabel: "Black",
    stockStatus: "in_stock",
  },
  {
    id: "p-led",
    name: "36W LED Panel Light",
    sku: "LED-36",
    barcodes: ["5550001112223"],
    kind: "simple",
    stockStatus: "in_stock",
  },
  {
    id: "p-db",
    name: "12-Way Distribution Board",
    sku: "DB-12",
    barcodes: ["5550001112223"],
    kind: "simple",
    stockStatus: "in_stock",
  },
  {
    id: "p-conduit",
    name: "Steel Conduit 20mm",
    sku: "CND-20",
    barcodes: ["0099887766554"],
    kind: "simple",
    stockStatus: "backorder",
  },
];

export const SELL_TEST_CUSTOMERS: readonly CustomerSearchResultView[] = [
  { id: "cust-ada", displayName: "Ada Boateng", kind: "retail" },
  {
    id: "cust-buildworks",
    displayName: "Buildworks Ltd",
    kind: "b2b",
    company: "Buildworks Ltd",
    phoneMasked: "+233 •• ••• 4488",
  },
];
