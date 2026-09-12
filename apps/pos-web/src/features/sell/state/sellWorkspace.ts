import { childrenOf, resolveBarcode } from "./barcodeResolution";
import {
  addOrIncrementLine,
  decrementLine,
  incrementLine,
  removeLine,
  setLineQuantity,
  type CartSnapshot,
  type LineIdFactory,
} from "./cartState";
import type {
  CatalogAvailability,
  CustomerSearchResultView,
  DraftStatusView,
  SellProductView,
  SellWorkspaceState,
} from "./sellView";

export type SellWorkspaceDeps = {
  readonly createCartId: () => string;
  readonly createLineId: LineIdFactory;
};

export function browseItems(catalog: readonly SellProductView[]): SellProductView[] {
  return catalog.filter((item) => item.kind !== "variation");
}

/** Only `unavailable` blocks catalog-driven cart mutation. stale/offline_cached remain usable. */
export function catalogMutationAllowed(availability: CatalogAvailability): boolean {
  return availability !== "unavailable";
}

export function createSellWorkspace(deps: SellWorkspaceDeps, catalog: readonly SellProductView[]): SellWorkspaceState {
  return {
    cartId: deps.createCartId(),
    cartRevision: 0,
    lines: [],
    selectedCustomer: null,
    commercialInvalidated: false,
    search: { query: "", status: "idle", results: browseItems(catalog) },
    notice: null,
    catalogAvailability: "fresh",
    draftStatus: { retainedLocally: false },
    mobileCartOpen: false,
  };
}

function withCart(state: SellWorkspaceState, cart: CartSnapshot): SellWorkspaceState {
  return {
    ...state,
    cartId: cart.cartId,
    cartRevision: cart.cartRevision,
    lines: cart.lines,
  };
}

export function applyNameSearch(state: SellWorkspaceState, query: string, catalog: readonly SellProductView[]): SellWorkspaceState {
  const searched = applySearchQuery(state, query, catalog);
  return {
    ...searched,
    notice: searched.notice?.kind === "unknown" ? null : searched.notice,
  };
}

export function applySearchQuery(state: SellWorkspaceState, query: string, catalog: readonly SellProductView[]): SellWorkspaceState {
  const needle = query.trim().toLowerCase();
  const results = needle
    ? catalog.filter((item) => {
        if (item.kind === "variation") return false;
        return (
          item.name.toLowerCase().includes(needle) ||
          (item.sku ?? "").toLowerCase().includes(needle) ||
          item.barcodes.some((code) => code.includes(query.trim()))
        );
      })
    : browseItems(catalog);
  return {
    ...state,
    search: { query, status: "ready", results },
  };
}

export function applyBarcodeScan(
  state: SellWorkspaceState,
  barcode: string,
  catalog: readonly SellProductView[],
  deps: SellWorkspaceDeps,
): SellWorkspaceState {
  if (!catalogMutationAllowed(state.catalogAvailability)) return state;
  const exact = barcode;
  const resolution = resolveBarcode(exact, catalog);
  if (resolution.kind === "empty") return state;
  if (resolution.kind === "unknown") {
    const searched = applySearchQuery(state, exact, catalog);
    return {
      ...searched,
      notice: { kind: "unknown", barcode: exact },
    };
  }
  if (resolution.kind === "collision") {
    return {
      ...state,
      notice: { kind: "collision", barcode: exact, matches: resolution.matches },
    };
  }
  if (resolution.kind === "chooser") {
    return {
      ...state,
      notice: {
        kind: "chooser",
        product: resolution.product,
        variations: childrenOf(resolution.product.id, catalog),
      },
    };
  }
  const cart = addOrIncrementLine(
    { cartId: state.cartId, cartRevision: state.cartRevision, lines: state.lines },
    resolution.item,
    deps.createLineId,
    exact,
  );
  return {
    ...withCart(state, cart),
    notice: null,
    draftStatus: { retainedLocally: state.draftStatus.retainedLocally },
  };
}

export function applyProductSelect(
  state: SellWorkspaceState,
  item: SellProductView,
  catalog: readonly SellProductView[],
  deps: SellWorkspaceDeps,
): SellWorkspaceState {
  if (!catalogMutationAllowed(state.catalogAvailability)) return state;
  if (item.kind === "variable") {
    return {
      ...state,
      notice: { kind: "chooser", product: item, variations: childrenOf(item.id, catalog) },
    };
  }
  const cart = addOrIncrementLine(
    { cartId: state.cartId, cartRevision: state.cartRevision, lines: state.lines },
    item,
    deps.createLineId,
  );
  return { ...withCart(state, cart), notice: null };
}

export function applyVariationSelect(
  state: SellWorkspaceState,
  variation: SellProductView,
  deps: SellWorkspaceDeps,
): SellWorkspaceState {
  if (!catalogMutationAllowed(state.catalogAvailability)) return state;
  const cart = addOrIncrementLine(
    { cartId: state.cartId, cartRevision: state.cartRevision, lines: state.lines },
    variation,
    deps.createLineId,
  );
  return { ...withCart(state, cart), notice: null };
}

export function applyQuantityChange(state: SellWorkspaceState, lineId: string, rawQuantity: string): SellWorkspaceState {
  return withCart(
    state,
    setLineQuantity({ cartId: state.cartId, cartRevision: state.cartRevision, lines: state.lines }, lineId, rawQuantity),
  );
}

export function applyQuantityIncrement(state: SellWorkspaceState, lineId: string): SellWorkspaceState {
  return withCart(
    state,
    incrementLine({ cartId: state.cartId, cartRevision: state.cartRevision, lines: state.lines }, lineId),
  );
}

export function applyQuantityDecrement(state: SellWorkspaceState, lineId: string): SellWorkspaceState {
  return withCart(
    state,
    decrementLine({ cartId: state.cartId, cartRevision: state.cartRevision, lines: state.lines }, lineId),
  );
}

export function applyRemoveLine(state: SellWorkspaceState, lineId: string): SellWorkspaceState {
  return withCart(
    state,
    removeLine({ cartId: state.cartId, cartRevision: state.cartRevision, lines: state.lines }, lineId),
  );
}

export function applySelectCustomer(state: SellWorkspaceState, customer: CustomerSearchResultView): SellWorkspaceState {
  if (state.selectedCustomer?.id === customer.id) return state;
  return {
    ...state,
    selectedCustomer: customer,
    cartRevision: state.cartRevision + 1,
    commercialInvalidated: true,
  };
}

export function applyClearCustomer(state: SellWorkspaceState): SellWorkspaceState {
  if (!state.selectedCustomer) return state;
  return {
    ...state,
    selectedCustomer: null,
    cartRevision: state.cartRevision + 1,
    commercialInvalidated: true,
  };
}

export function applyNewSale(state: SellWorkspaceState, catalog: readonly SellProductView[], deps: SellWorkspaceDeps): SellWorkspaceState {
  return {
    ...createSellWorkspace(deps, catalog),
    catalogAvailability: state.catalogAvailability,
    draftStatus: { retainedLocally: false },
  };
}

export function applyCatalogAvailability(state: SellWorkspaceState, availability: CatalogAvailability): SellWorkspaceState {
  return { ...state, catalogAvailability: availability };
}

export function applyDraftStatus(state: SellWorkspaceState, draftStatus: DraftStatusView): SellWorkspaceState {
  return { ...state, draftStatus };
}

export function applyMobileCartOpen(state: SellWorkspaceState, open: boolean): SellWorkspaceState {
  return { ...state, mobileCartOpen: open };
}

export function dismissNotice(state: SellWorkspaceState): SellWorkspaceState {
  return { ...state, notice: null };
}
