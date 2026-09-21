import { createElement, useMemo, type ComponentProps, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { SellScreen } from "../../apps/pos-web/src/features/sell/SellScreen";
import { bindPriceCacheToGeneration } from "../../apps/pos-web/src/features/sell/runtime/productDisplayPriceCache";
import { enrichSellProductPrices, searchCatalogViews } from "../../apps/pos-web/src/features/sell/runtime/catalogLookup";
import {
  applyMobileCartOpen,
  applyProductSelect,
  applySelectCustomer,
  createSellWorkspace,
} from "../../apps/pos-web/src/features/sell/state/sellWorkspace";
import type { ProductDisplayPriceView } from "../../apps/pos-web/src/features/sell/state/variableDisplayPrice";
import type { CustomerSearchResultView, SellProductView, SellWorkspaceState } from "../../apps/pos-web/src/features/sell/state/sellView";
import type { CatalogItem } from "../../docs/contracts/domain.generated";
import type { CatalogPort } from "../../docs/contracts/ports";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CORRELATION = "00000000-0000-4000-8000-000000000014";
const CUSTOMER: CustomerSearchResultView = { id: "cust-ada", displayName: "Ada Boateng", kind: "retail" };

type FakeNode = {
  nodeType: number;
  nodeName: string;
  tagName: string;
  childNodes: FakeNode[];
  parentNode: FakeNode | null;
  ownerDocument: FakeDocument;
  style: { cssText: string };
  attributes: Map<string, string>;
  textContent: string;
  value: string;
  className: string;
  disabled: boolean;
  checked: boolean;
  href: string;
  innerHTML: string;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  appendChild: (child: FakeNode) => FakeNode;
  removeChild: (child: FakeNode) => FakeNode;
  insertBefore: (child: FakeNode, ref: FakeNode | null) => FakeNode;
  addEventListener: () => void;
  removeEventListener: () => void;
  dispatchEvent: () => boolean;
  cloneNode: () => FakeNode;
  contains: (other: FakeNode) => boolean;
  focus: () => void;
  blur: () => void;
  get nextSibling(): FakeNode | null;
};

type FakeDocument = {
  nodeType: 9;
  body: FakeNode;
  documentElement: FakeNode;
  defaultView: FakeWindow;
  activeElement: FakeNode | null;
  createElement: (tag: string) => FakeNode;
  createElementNS: (_ns: string, tag: string) => FakeNode;
  createTextNode: (text: string) => FakeNode;
  createComment: () => FakeNode;
  getElementById: () => null;
  querySelector: () => null;
  querySelectorAll: () => FakeNode[];
  addEventListener: () => void;
  removeEventListener: () => void;
};

type FakeWindow = {
  document: FakeDocument;
  addEventListener: () => void;
  removeEventListener: () => void;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
  navigator: { userAgent: string };
  HTMLElement: new () => unknown;
  HTMLIFrameElement: new () => unknown;
};

function createFakeNode(document: FakeDocument, nodeType: number, tagName: string, text = ""): FakeNode {
  const node: FakeNode = {
    nodeType,
    nodeName: nodeType === 3 ? "#text" : tagName.toUpperCase(),
    tagName: tagName.toUpperCase(),
    childNodes: [],
    parentNode: null,
    ownerDocument: document,
    style: { cssText: "" },
    attributes: new Map(),
    textContent: text,
    value: "",
    className: "",
    disabled: false,
    checked: false,
    href: "",
    innerHTML: "",
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === "class") this.className = String(value);
      if (name === "value") this.value = String(value);
    },
    getAttribute(name) {
      if (name === "class" && this.className) return this.className;
      return this.attributes.get(name) ?? null;
    },
    removeAttribute(name) {
      this.attributes.delete(name);
    },
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      this.childNodes.push(child);
      child.parentNode = this;
      return child;
    },
    removeChild(child) {
      this.childNodes = this.childNodes.filter((entry) => entry !== child);
      child.parentNode = null;
      return child;
    },
    insertBefore(child, ref) {
      if (child.parentNode) child.parentNode.removeChild(child);
      if (!ref) return this.appendChild(child);
      const index = this.childNodes.indexOf(ref);
      this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, child);
      child.parentNode = this;
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    cloneNode() {
      return createFakeNode(document, this.nodeType, this.tagName, this.textContent);
    },
    contains(other) {
      if (other === this) return true;
      return this.childNodes.some((child) => child.contains(other));
    },
    focus() {},
    blur() {},
    get nextSibling() {
      if (!this.parentNode) return null;
      const index = this.parentNode.childNodes.indexOf(this);
      return this.parentNode.childNodes[index + 1] ?? null;
    },
  };
  Object.defineProperty(node, "innerHTML", {
    get() {
      return serializeNode(node);
    },
    set() {},
  });
  return node;
}

function serializeNode(node: FakeNode): string {
  if (node.nodeType === 3) {
    return node.textContent;
  }
  const children = node.childNodes.map(serializeNode).join("");
  if (node.nodeType !== 1) {
    return children;
  }
  const attrs = [...node.attributes.entries()].map(([name, value]) => ` ${name}="${value}"`).join("");
  const tag = node.tagName.toLowerCase();
  return `<${tag}${attrs}>${children}${node.textContent && node.childNodes.length === 0 ? node.textContent : ""}</${tag}>`;
}

function installFakeDom(): { container: FakeNode; cleanup: () => void } {
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: (globalThis as { HTMLElement?: unknown }).HTMLElement,
    Element: (globalThis as { Element?: unknown }).Element,
    Node: (globalThis as { Node?: unknown }).Node,
    Text: (globalThis as { Text?: unknown }).Text,
  };
  const document = {} as FakeDocument;
  const HtmlElement = function HTMLElement() {};
  const HtmlIFrameElement = function HTMLIFrameElement() {};
  const window = {
    document,
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    navigator: { userAgent: "node" },
    HTMLElement: HtmlElement,
    HTMLIFrameElement: HtmlIFrameElement,
  } as FakeWindow;
  document.nodeType = 9;
  document.defaultView = window;
  document.createElement = (tag) => createFakeNode(document, 1, tag);
  document.createElementNS = (_ns, tag) => createFakeNode(document, 1, tag);
  document.createTextNode = (text) => createFakeNode(document, 3, "#text", String(text));
  document.createComment = () => createFakeNode(document, 8, "#comment");
  document.getElementById = () => null;
  document.querySelector = () => null;
  document.querySelectorAll = () => [];
  document.addEventListener = () => undefined;
  document.removeEventListener = () => undefined;
  document.documentElement = document.createElement("html");
  document.body = document.createElement("body");
  document.activeElement = document.body;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { window: FakeWindow }).window = window;
  (globalThis as { document: FakeDocument }).document = document;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    get: () => window.navigator,
  });
  (globalThis as { HTMLElement: unknown }).HTMLElement = HtmlElement;
  (globalThis as { HTMLIFrameElement: unknown }).HTMLIFrameElement = HtmlIFrameElement;
  (globalThis as { Element: unknown }).Element = HtmlElement;
  (globalThis as { Node: unknown }).Node = function Node() {};
  (globalThis as { Text: unknown }).Text = function Text() {};
  const container = document.createElement("div");
  document.body.appendChild(container);
  return {
    container,
    cleanup() {
      (globalThis as { window: unknown }).window = previous.window;
      (globalThis as { document: unknown }).document = previous.document;
      (globalThis as { HTMLElement: unknown }).HTMLElement = previous.HTMLElement;
      (globalThis as { Element: unknown }).Element = previous.Element;
      (globalThis as { Node: unknown }).Node = previous.Node;
      (globalThis as { Text: unknown }).Text = previous.Text;
    },
  };
}

function money(minor: number, currency = "GHS") {
  return { minor, currency };
}

function child(id: string, minor?: number): CatalogItem {
  return {
    id,
    name: `Child ${id}`,
    barcodes: [],
    kind: "variation",
    parentId: "parent",
    stockStatus: "in_stock",
    projectionUpdatedAt: "2026-09-19T00:00:00.000Z",
    displayPrice: minor === undefined ? undefined : money(minor),
  };
}

const PARENT: CatalogItem = {
  id: "parent",
  name: "Variable parent",
  barcodes: [],
  kind: "variable",
  stockStatus: "in_stock",
  projectionUpdatedAt: "2026-09-19T00:00:00.000Z",
};

const SIMPLE: CatalogItem = {
  id: "simple",
  name: "Simple cable",
  barcodes: ["0012345678901"],
  kind: "simple",
  stockStatus: "in_stock",
  projectionUpdatedAt: "2026-09-19T00:00:00.000Z",
  displayPrice: money(1_500),
};

function mutableCatalog(initialMinors: Array<number | undefined>): CatalogPort & {
  setChildMinors: (minors: Array<number | undefined>) => void;
} {
  let minors = initialMinors;
  return {
    setChildMinors(next) {
      minors = next;
    },
    async search(input) {
      if (input.parentId === "parent") {
        return {
          ok: true,
          data: { items: minors.map((minor, index) => child(`c${index}`, minor)) },
          correlationId: CORRELATION,
        };
      }
      return {
        ok: true,
        data: { items: [PARENT, SIMPLE] },
        correlationId: CORRELATION,
      };
    },
  };
}

function Harness({
  generation,
  catalog,
  cache,
  initialState,
  onWorkspaceChange,
  checkoutSession,
  createCartId,
  onRetireCart,
}: {
  readonly generation: number;
  readonly catalog: CatalogPort;
  readonly cache: Map<string, ProductDisplayPriceView>;
  readonly initialState: SellWorkspaceState;
  readonly onWorkspaceChange: (state: SellWorkspaceState) => void;
  readonly checkoutSession?: ComponentProps<typeof SellScreen>["checkoutSession"];
  readonly createCartId?: () => string;
  readonly onRetireCart?: ComponentProps<typeof SellScreen>["onRetireCart"];
}): ReactNode {
  const observed = useMemo(() => ({ current: undefined as number | undefined }), []);
  bindPriceCacheToGeneration(cache, observed, generation);
  const searchCatalog = useMemo(
    () => async (query: string) => {
      const result = await searchCatalogViews(catalog, query);
      if (!result.ok) {
        return [];
      }
      return enrichSellProductPrices(catalog, result.items, cache);
    },
    [cache, catalog],
  );
  return createElement(SellScreen, {
    catalog: initialState.search.results,
    customers: [CUSTOMER],
    initialState,
    catalogProjectionGeneration: generation,
    searchCatalog,
    createCartId: createCartId ?? (() => "cart-should-not-recreate"),
    createLineId: () => "line-should-not-recreate",
    checkoutSession,
    onRetireCart,
    onWorkspaceChange,
  });
}

async function renderHarness(
  root: Root,
  props: {
    readonly generation: number;
    readonly catalog: CatalogPort;
    readonly cache: Map<string, ProductDisplayPriceView>;
    readonly initialState: SellWorkspaceState;
    readonly onWorkspaceChange: (state: SellWorkspaceState) => void;
    readonly checkoutSession?: ComponentProps<typeof SellScreen>["checkoutSession"];
    readonly createCartId?: () => string;
    readonly onRetireCart?: ComponentProps<typeof SellScreen>["onRetireCart"];
  },
): Promise<void> {
  await act(async () => {
    root.render(createElement(Harness, props));
  });
}

describe("UX-03 visible ProductCard refresh after projection generation", () => {
  test("SellScreen ProductCards update range without resetting cart identity", async () => {
    const fake = installFakeDom();
    const catalog = mutableCatalog([6_500, 56_700]);
    const cache = new Map<string, ProductDisplayPriceView>();
    const search = await searchCatalogViews(catalog, "");
    expect(search.ok).toBe(true);
    if (!search.ok) {
      throw new Error("search");
    }
    const views = await enrichSellProductPrices(catalog, search.items, cache);
    const deps = {
      createCartId: () => "cart-live",
      createLineId: () => "line-live",
    };
    const simple = views.find((item) => item.id === "simple") as SellProductView;
    let state = createSellWorkspace(deps, views);
    state = applyProductSelect(state, simple, views, deps);
    state = applySelectCustomer(state, CUSTOMER);
    state = applyMobileCartOpen(state, true);
    const snapshot = {
      cartId: state.cartId,
      cartRevision: state.cartRevision,
      lines: state.lines,
      customerId: state.selectedCustomer?.id,
      commercialInvalidated: state.commercialInvalidated,
      mobileCartOpen: state.mobileCartOpen,
    };
    let latest = state;
    const root = createRoot(fake.container as unknown as Element);
    try {
      await renderHarness(root, {
        generation: 1,
        catalog,
        cache,
        initialState: state,
        onWorkspaceChange: (next) => {
          latest = next;
        },
      });
      const firstHtml = serializeNode(fake.container);
      expect(firstHtml).toContain("GHS 65.00 – GHS 567.00");
      expect(firstHtml).toContain("Simple cable");
      expect(firstHtml).toContain("Ada Boateng");

      catalog.setChildMinors([10_000, 20_000]);
      await renderHarness(root, {
        generation: 2,
        catalog,
        cache,
        initialState: state,
        onWorkspaceChange: (next) => {
          latest = next;
        },
      });
      await act(async () => {
        await Promise.resolve();
      });
      const secondHtml = serializeNode(fake.container);
      expect(secondHtml).toContain("GHS 100.00 – GHS 200.00");
      expect(secondHtml).not.toContain("GHS 65.00 – GHS 567.00");
      expect(latest.cartId).toBe(snapshot.cartId);
      expect(latest.cartRevision).toBe(snapshot.cartRevision);
      expect(latest.lines).toEqual(snapshot.lines);
      expect(latest.selectedCustomer?.id).toBe(snapshot.customerId);
      expect(latest.commercialInvalidated).toBe(snapshot.commercialInvalidated);
      expect(latest.mobileCartOpen).toBe(snapshot.mobileCartOpen);
      expect(latest.search.query).toBe(state.search.query);
    } finally {
      await act(async () => {
        root.unmount();
      });
      fake.cleanup();
    }
  });

  test("visible card replaces cached Price unavailable after a later complete projection", async () => {
    const fake = installFakeDom();
    const catalog = mutableCatalog([undefined, undefined]);
    const cache = new Map<string, ProductDisplayPriceView>();
    const search = await searchCatalogViews(catalog, "");
    expect(search.ok).toBe(true);
    if (!search.ok) {
      throw new Error("search");
    }
    const views = await enrichSellProductPrices(catalog, search.items, cache);
    const parent = views.find((item) => item.id === "parent");
    expect(parent?.priceView).toEqual({ kind: "unavailable" });
    const deps = {
      createCartId: () => "cart-unavailable",
      createLineId: () => "line-unavailable",
    };
    const state = createSellWorkspace(deps, views);
    let latest = state;
    const root = createRoot(fake.container as unknown as Element);
    try {
      await renderHarness(root, {
        generation: 1,
        catalog,
        cache,
        initialState: state,
        onWorkspaceChange: (next) => {
          latest = next;
        },
      });
      expect(serializeNode(fake.container)).toContain("Price unavailable");

      catalog.setChildMinors([10_000, 20_000]);
      await renderHarness(root, {
        generation: 2,
        catalog,
        cache,
        initialState: state,
        onWorkspaceChange: (next) => {
          latest = next;
        },
      });
      await act(async () => {
        await Promise.resolve();
      });
      const html = serializeNode(fake.container);
      expect(html).toContain("GHS 100.00 – GHS 200.00");
      expect(html).not.toContain("Price unavailable");
      expect(latest.cartId).toBe("cart-unavailable");
      expect(latest.cartRevision).toBe(0);
      expect(latest.lines).toEqual([]);
    } finally {
      await act(async () => {
        root.unmount();
      });
      fake.cleanup();
    }
  });

  test("completed sale retires the sold cart and rotates to one fresh cart exactly once", async () => {
    const fake = installFakeDom();
    const catalog = mutableCatalog([6_500, 56_700]);
    const cache = new Map<string, ProductDisplayPriceView>();
    const search = await searchCatalogViews(catalog, "");
    expect(search.ok).toBe(true);
    if (!search.ok) {
      throw new Error("search");
    }
    const views = await enrichSellProductPrices(catalog, search.items, cache);
    const simple = views.find((item) => item.id === "simple") as SellProductView;
    const deps = {
      createCartId: () => "cart-completed",
      createLineId: () => "line-completed",
    };
    let state = createSellWorkspace(deps, views);
    state = applyProductSelect(state, simple, views, deps);

    const retired: Array<{ cartId: string; reason: "completed" | "discarded" }> = [];
    let latest = state;
    let nextCartCalls = 0;
    const completedSession = {
      stage: "complete" as const,
      message: "The sale is complete.",
      printStatus: "idle" as const,
      saleCompleted: true,
      transactionId: "11111111-1111-4111-8111-111111111099",
    };
    const root = createRoot(fake.container as unknown as Element);

    try {
      const props = {
        generation: 1,
        catalog,
        cache,
        initialState: state,
        checkoutSession: completedSession,
        createCartId: () => {
          nextCartCalls += 1;
          return "cart-next";
        },
        onRetireCart: (cartId: string, reason: "completed" | "discarded") => {
          retired.push({ cartId, reason });
        },
        onWorkspaceChange: (next: SellWorkspaceState) => {
          latest = next;
        },
      };

      await renderHarness(root, props);
      await act(async () => {
        await Promise.resolve();
      });

      expect(retired).toEqual([{ cartId: "cart-completed", reason: "completed" }]);
      expect(latest.cartId).toBe("cart-next");
      expect(latest.cartRevision).toBe(0);
      expect(latest.lines).toEqual([]);
      expect(nextCartCalls).toBe(1);

      await renderHarness(root, props);
      await act(async () => {
        await Promise.resolve();
      });

      expect(retired).toHaveLength(1);
      expect(latest.cartId).toBe("cart-next");
      expect(nextCartCalls).toBe(1);
    } finally {
      await act(async () => {
        root.unmount();
      });
      fake.cleanup();
    }
  });

  test("generation is passed into SellScreen and does not remount via key", () => {
    const sell = readFileSync(resolve(repoRoot, "apps/pos-web/src/features/sell/SellScreen.tsx"), "utf8");
    const runtime = readFileSync(
      resolve(repoRoot, "apps/pos-web/src/features/sell/runtime/SellRuntimeScreen.tsx"),
      "utf8",
    );
    expect(runtime).toContain("catalogProjectionGeneration={projectionGeneration}");
    expect(runtime).not.toContain("key={projectionGeneration}");
    expect(runtime).not.toContain("key={catalogProjectionGeneration}");
    expect(sell).toContain("bindLocalGeneration(observedProjectionGenerationRef, generation)");
    expect(sell).toContain("applyVisibleSearchResults(current, query, results)");
    expect(sell).toContain("void searchCatalog(query)");
  });
});
