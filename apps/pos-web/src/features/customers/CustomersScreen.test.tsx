import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { CustomerSummary } from "../../../../../docs/contracts/domain.generated";
import { CustomersScreen } from "./CustomersScreen";

const customers: readonly CustomerSummary[] = [
  { id: "retail-1", kind: "retail", displayName: "Adwoa Mensah", phoneMasked: "*** 0123" },
  { id: "b2b-1", kind: "b2b", displayName: "Kojo Stores", company: "Kojo Stores Ltd", phoneMasked: "*** 9876" },
];

function render(props: Partial<ComponentProps<typeof CustomersScreen>> = {}) {
  return renderToStaticMarkup(<CustomersScreen customers={customers} {...props} />);
}

describe("CustomersScreen", () => {
  test("renders retail and wholesale customer context without provider internals", () => {
    const html = render();
    expect(html).toContain("Customers");
    expect(html).toContain("Adwoa Mensah");
    expect(html).toContain("Kojo Stores Ltd");
    expect(html).toContain("Wholesale");
    expect(html).toContain("Retail");
    expect(html).not.toContain("B2BKing");
    expect(html).not.toContain("WooCommerce");
  });

  test.each([
    ["offline", "Walk-in sales remain the safe fallback."],
    ["degraded", "Customer lookup is degraded."],
    ["error", "Customers could not be loaded."],
    ["loading", "Loading customers…"],
  ] as const)("renders %s state", (state, copy) => {
    expect(render({ state })).toContain(copy);
  });

  test("renders explicit empty state", () => {
    const html = renderToStaticMarkup(<CustomersScreen customers={[]} />);
    expect(html).toContain("No customers available.");
  });
});
