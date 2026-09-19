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
    expect(html).toContain("WHOLESALE");
    expect(html).toContain("Retail");
    expect(html).not.toContain("Group A");
    expect(html).not.toContain("B2BKing");
    expect(html).not.toContain("WooCommerce");
  });

  test.each([
    ["offline", "Walk-in sales remain the safe fallback."],
    ["degraded", "Customer search is temporarily limited."],
    ["error", "Customers could not be loaded."],
    ["loading", "Loading customers…"],
  ] as const)("renders %s state", (state, copy) => {
    expect(render({ state })).toContain(copy);
  });

  test("renders explicit empty state", () => {
    const html = renderToStaticMarkup(<CustomersScreen customers={[]} />);
    expect(html).toContain("No customer accounts available.");
  });

  test("shows optional commercial context only when supplied", () => {
    const withContext = render({ commercialContextById: { "b2b-1": "Trade account" }, onUseCustomer: () => undefined });
    expect(withContext).toContain("Wholesale · Trade account");
    expect(withContext).toContain("Use for next sale");
    const withoutContext = render({ onUseCustomer: () => undefined });
    expect(withoutContext).not.toContain("Trade account");
    expect(withoutContext).not.toContain("Group A");
  });

  test("keeps name, company or phone search copy", () => {
    expect(render()).toContain("Name, company or phone");
  });

  test("remote search results are not re-filtered against masked phone", () => {
    const html = renderToStaticMarkup(
      <CustomersScreen
        customers={[{ id: "retail-1", kind: "retail", displayName: "Adwoa Mensah", phoneMasked: "*** 0123" }]}
        onSearchQueryChange={() => undefined}
      />,
    );
    expect(html).toContain("Adwoa Mensah");
    expect(html).toContain("*** 0123");
    expect(html).not.toContain("0241234567");
  });
});
