import type { CartDraftStore, CatalogPort, CustomerPort } from "../../../../../../docs/contracts/ports";
import { customerViewFromSummary, draftLinesToViews } from "./mapCartDraft";
import { lookupProductView } from "./catalogLookup";
import { browseItems, createSellWorkspace, type SellWorkspaceDeps } from "../state/sellWorkspace";
import type { CatalogAvailability, CustomerSearchResultView, SellProductView, SellWorkspaceState } from "../state/sellView";

export type RestoreSellWorkspaceInput = {
  readonly catalog: CatalogPort;
  readonly customers: CustomerPort;
  readonly drafts: CartDraftStore;
  readonly recallCartId: () => Promise<string | null>;
  readonly browseCatalog: readonly SellProductView[];
  readonly deps: SellWorkspaceDeps;
  readonly availability: CatalogAvailability;
};

export async function restoreSellWorkspace(input: RestoreSellWorkspaceInput): Promise<SellWorkspaceState> {
  const empty = createSellWorkspace(input.deps, input.browseCatalog);
  const cartId = await input.recallCartId();
  if (!cartId) {
    return { ...empty, catalogAvailability: input.availability };
  }
  const draft = await input.drafts.load(cartId);
  if (!draft) {
    return { ...empty, catalogAvailability: input.availability };
  }
  const catalogById = new Map<string, { name: string; sku?: string; variationLabel?: string }>();
  for (const line of draft.lines) {
    const ids = [line.variationId, line.productId].filter((id): id is string => Boolean(id));
    for (const id of ids) {
      const item = await lookupProductView(input.catalog, id);
      if (item) {
        catalogById.set(item.id, item);
      }
    }
  }
  return {
    ...empty,
    cartId: draft.cartId,
    cartRevision: draft.revision,
    lines: draftLinesToViews(draft, catalogById),
    selectedCustomer: await restoreCustomer(input.customers, draft.customer.kind === "walkin" ? null : draft.customer),
    catalogAvailability: input.availability,
    draftStatus: { retainedLocally: true },
    search: { query: "", status: "ready", results: browseItems(input.browseCatalog) },
  };
}

async function restoreCustomer(
  customers: CustomerPort,
  context: { readonly kind: "retail" | "b2b"; readonly customerId: string } | null,
): Promise<CustomerSearchResultView | null> {
  if (!context) {
    return null;
  }
  const found = await customers.search("");
  if (found.ok) {
    const match = found.data.find((row) => row.id === context.customerId);
    if (match) {
      return customerViewFromSummary(match);
    }
  }
  return {
    id: context.customerId,
    displayName: context.customerId,
    kind: context.kind,
  };
}
