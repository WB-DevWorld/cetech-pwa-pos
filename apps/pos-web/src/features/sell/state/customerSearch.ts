import type { CustomerSearchResultView } from "./sellView";

export function filterCustomerResults(
  customers: readonly CustomerSearchResultView[],
  query: string,
): CustomerSearchResultView[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...customers];
  return customers.filter((customer) => {
    return (
      customer.displayName.toLowerCase().includes(needle) ||
      (customer.company ?? "").toLowerCase().includes(needle) ||
      (customer.phoneMasked ?? "").toLowerCase().includes(needle)
    );
  });
}

export function customerSecondaryText(customer: CustomerSearchResultView): string | null {
  const parts = [customer.company, customer.phoneMasked].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : null;
}
