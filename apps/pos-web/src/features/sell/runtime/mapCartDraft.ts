import type { CartDraft, CustomerContext, CustomerSummary } from "../../../../../../docs/contracts/domain.generated";
import type { CartLineView, CustomerSearchResultView, SellWorkspaceState } from "../state/sellView";

export function customerContextFromSelection(
  customer: CustomerSearchResultView | null,
): CustomerContext {
  if (!customer) {
    return { kind: "walkin" };
  }
  return {
    kind: customer.kind === "b2b" ? "b2b" : "retail",
    customerId: customer.id,
  };
}

export function customerViewFromSummary(customer: CustomerSummary): CustomerSearchResultView {
  return {
    id: customer.id,
    displayName: customer.displayName,
    kind: customer.kind,
    company: customer.company,
    phoneMasked: customer.phoneMasked,
  };
}

export function workspaceToCartDraft(
  state: SellWorkspaceState,
  locationId: string,
  updatedAt: string,
): CartDraft {
  return {
    cartId: state.cartId,
    revision: state.cartRevision,
    customer: customerContextFromSelection(state.selectedCustomer),
    locationId,
    lines: state.lines.map((line) => ({
      lineId: line.lineId,
      productId: line.catalogItemId,
      variationId: line.variationId,
      quantity: line.quantity,
    })),
    updatedAt,
  };
}

export function draftLinesToViews(
  draft: CartDraft,
  catalogById: ReadonlyMap<string, { name: string; sku?: string; variationLabel?: string }>,
): readonly CartLineView[] {
  return draft.lines.map((line) => {
    const catalogId = line.variationId ?? line.productId;
    const item = catalogById.get(catalogId) ?? catalogById.get(line.productId);
    return {
      lineId: line.lineId,
      catalogItemId: line.productId,
      variationId: line.variationId,
      name: item?.name ?? "Unavailable item",
      variationLabel: item?.variationLabel,
      sku: item?.sku,
      quantity: line.quantity,
    };
  });
}
