import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { OrderDetailDialog, OrdersScreen, matchesOrderSearch, type OrderDetailView, type OrderListItemView } from "./OrdersScreen";

const order: OrderListItemView = {
  id: "order-1",
  orderReference: "#1042",
  receiptNumber: "POS-1042",
  customerLabel: "Accra Builders Ltd",
  customerId: "cust-buildworks",
  customerCompany: "BuildWorks Ghana Ltd",
  customerKind: "b2b",
  createdAt: "2026-09-17T10:00:00.000Z",
  paymentLabel: "Mobile Money",
  paymentStatus: "verified",
  total: { minor: 24500, currency: "GHS" },
  status: "completed",
  transactionReference: "tx-1042",
};

function render(props: Partial<ComponentProps<typeof OrdersScreen>> = {}) {
  return renderToStaticMarkup(<OrdersScreen orders={[order]} {...props} />);
}

const orderDetail: OrderDetailView = {
  ...order,
  cashierLabel: "Ben",
  registerLabel: "Main Counter",
  lines: [{ id: "line-1", name: "LED Panel", quantity: "2", total: { minor: 24500, currency: "GHS" } }],
};

describe("OrdersScreen", () => {
  test("renders approved order search/table semantics", () => {
    const html = render();
    expect(html).toContain("Orders");
    expect(html).toContain("Find sales, reprint receipts, and start returns.");
    expect(html).toContain("Search orders");
    expect(html).toContain("#1042");
    expect(html).toContain("POS-1042");
    expect(html).toContain("BuildWorks Ghana Ltd");
    expect(html).toContain("Wholesale");
    expect(html).toContain("GHS 245.00");
    expect(html).toContain("Completed");
  });

  test("matches company and canonical customer identity in the Orders search predicate", () => {
    expect(matchesOrderSearch(order, "buildworks ghana")).toBe(true);
    expect(matchesOrderSearch(order, "cust-buildworks")).toBe(true);
    expect(matchesOrderSearch(order, "no-such-customer")).toBe(false);
  });

  test.each([
    ["offline", "Offline."],
    ["degraded", "Orders are partially available."],
    ["error", "Orders could not be loaded."],
    ["loading", "Loading orders…"],
  ] as const)("renders %s state without a blank screen", (state, copy) => {
    expect(render({ state })).toContain(copy);
  });

  test("renders approved detail, reprint and return action semantics", () => {
    const html = renderToStaticMarkup(
      <OrderDetailDialog
        open
        order={orderDetail}
        onClose={() => undefined}
        onReprint={() => undefined}
        onStartReturn={() => undefined}
      />,
    );
    expect(html).toContain("Order detail");
    expect(html).toContain("Reference");
    expect(html).toContain("Cashier / register");
    expect(html).toContain("Customer account ID");
    expect(html).toContain("cust-buildworks");
    expect(html).toContain("BuildWorks Ghana Ltd");
    expect(html).toContain("Reprint");
    expect(html).toContain("Return items");
    expect(html).toContain("LED Panel");
  });

  test("renders an explicit empty state", () => {
    const html = renderToStaticMarkup(<OrdersScreen orders={[]} />);
    expect(html).toContain("No sales available.");
    expect(html).toContain("Completed sales will appear here when order history is available.");
  });
});
