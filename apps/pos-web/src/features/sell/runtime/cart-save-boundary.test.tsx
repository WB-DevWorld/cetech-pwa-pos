import "fake-indexeddb/auto";
import { createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { createCartDraftStore } from "../../../local/cart-draft-store";
import { openPosLocalDatabase } from "../../../local";
import { workspaceToCartDraft } from "./mapCartDraft";
import { restoreSellWorkspace } from "./restoreWorkspace";
import { SellScreen } from "../SellScreen";
import { createSellWorkspace } from "../state/sellWorkspace";
import type { SellWorkspaceState } from "../state/sellView";

type Listener = (event: EventLike) => void;
type EventLike = {
  type: string;
  bubbles: boolean;
  cancelable: boolean;
  target: DomNode;
  currentTarget: DomNode | null;
  defaultPrevented: boolean;
  timeStamp: number;
  button: number;
  preventDefault: () => void;
  stopPropagation: () => void;
  composedPath: () => DomNode[];
};
type DomNode = {
  nodeType: number;
  nodeName: string;
  tagName: string;
  textContent: string;
  nodeValue: string | null;
  ownerDocument: unknown;
  parentNode: DomNode | null;
  childNodes: DomNode[];
  firstChild: DomNode | null;
  lastChild: DomNode | null;
  nextSibling: DomNode | null;
  style: Record<string, string>;
  attributes: Record<string, string>;
  disabled?: boolean;
  value?: string;
  listeners: Map<string, Listener[]>;
  appendChild: (child: DomNode) => DomNode;
  insertBefore: (child: DomNode, before: DomNode | null) => DomNode;
  removeChild: (child: DomNode) => DomNode;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  removeAttribute: (name: string) => void;
  hasAttribute: (name: string) => boolean;
  querySelector: (selector: string) => DomNode | null;
  querySelectorAll: (selector: string) => DomNode[];
  addEventListener: (type: string, listener: Listener) => void;
  removeEventListener: (type: string, listener: Listener) => void;
  dispatchEvent: (event: EventLike) => boolean;
  focus: (options?: { preventScroll?: boolean }) => void;
  blur: () => void;
};

function installDocument(): void {
  const create = (nodeType: number, name: string): DomNode => {
    let storedText = "";
    const node = {
      nodeType,
      nodeName: name,
      tagName: name,
      ownerDocument: null,
      parentNode: null,
      childNodes: [],
      style: {},
      attributes: {},
      listeners: new Map<string, Listener[]>(),
      get textContent() {
        if (this.nodeType === 3 || this.nodeType === 8) return storedText;
        return this.childNodes.map((child) => child.textContent).join("");
      },
      set textContent(value: string) {
        storedText = String(value ?? "");
        if (this.nodeType === 1 || this.nodeType === 11) {
          this.childNodes = [];
          if (storedText && this.ownerDocument && typeof this.ownerDocument === "object") {
            const created = (this.ownerDocument as { createTextNode: (text: string) => DomNode }).createTextNode(storedText);
            created.parentNode = this;
            this.childNodes.push(created);
          }
        }
      },
      get nodeValue() {
        return this.nodeType === 3 || this.nodeType === 8 ? storedText : null;
      },
      set nodeValue(value: string | null) {
        if (this.nodeType === 3 || this.nodeType === 8) storedText = value ?? "";
      },
      get firstChild() {
        return this.childNodes[0] ?? null;
      },
      get lastChild() {
        return this.childNodes[this.childNodes.length - 1] ?? null;
      },
      get nextSibling() {
        const siblings = this.parentNode?.childNodes ?? [];
        const index = siblings.indexOf(this);
        return index >= 0 ? siblings[index + 1] ?? null : null;
      },
      appendChild(child: DomNode) {
        if (child.parentNode) child.parentNode.removeChild(child);
        this.childNodes.push(child);
        child.parentNode = this;
        return child;
      },
      insertBefore(child: DomNode, before: DomNode | null) {
        if (child.parentNode) child.parentNode.removeChild(child);
        const index = before ? this.childNodes.indexOf(before) : -1;
        if (index < 0) this.childNodes.push(child);
        else this.childNodes.splice(index, 0, child);
        child.parentNode = this;
        return child;
      },
      removeChild(child: DomNode) {
        this.childNodes = this.childNodes.filter((item) => item !== child);
        child.parentNode = null;
        return child;
      },
      setAttribute(name: string, value: string) {
        this.attributes[name] = String(value);
      },
      getAttribute(name: string) {
        return this.attributes[name] ?? null;
      },
      removeAttribute(name: string) {
        delete this.attributes[name];
      },
      hasAttribute(name: string) {
        return Object.prototype.hasOwnProperty.call(this.attributes, name);
      },
      querySelector(selector: string) {
        return this.querySelectorAll(selector)[0] ?? null;
      },
      querySelectorAll(selector: string) {
        const parts = selector.split(",").map((part) => part.trim()).filter(Boolean);
        const found: DomNode[] = [];
        const visit = (candidate: DomNode) => {
          if (candidate !== this && parts.some((part) => matchesSelector(candidate, part))) found.push(candidate);
          for (const child of candidate.childNodes) visit(child);
        };
        visit(this);
        return found;
      },
      addEventListener(type: string, listener: Listener) {
        const list = this.listeners.get(type) ?? [];
        list.push(listener);
        this.listeners.set(type, list);
      },
      removeEventListener(type: string, listener: Listener) {
        this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== listener));
      },
      dispatchEvent(event: EventLike) {
        const path: DomNode[] = [];
        let current: DomNode | null = event.target;
        while (current) {
          path.push(current);
          current = current.parentNode;
        }
        for (const target of path) {
          event.currentTarget = target;
          for (const listener of target.listeners.get(event.type) ?? []) listener(event);
        }
        return true;
      },
      focus(options?: { preventScroll?: boolean }) {
        void options;
      },
      blur() {
        this.dispatchEvent(eventFor(this, "blur"));
      },
    } satisfies DomNode;
    return node;
  };
  const documentNode = create(9, "#document");
  const element = create(1, "HTML");
  const body = create(1, "BODY");
  documentNode.appendChild(element);
  element.appendChild(body);
  const document = {
    nodeType: 9,
    documentElement: element,
    body,
    defaultView: globalThis,
    createElement(tag: string) {
      const created = create(1, tag.toUpperCase());
      created.ownerDocument = document;
      return created;
    },
    createElementNS(_namespace: string, tag: string) {
      return this.createElement(tag);
    },
    createTextNode(text: string) {
      const created = create(3, "#text");
      created.textContent = text;
      created.ownerDocument = document;
      return created;
    },
    createComment(text: string) {
      const created = create(8, "#comment");
      created.textContent = text;
      created.ownerDocument = document;
      return created;
    },
    createDocumentFragment() {
      const created = create(11, "#fragment");
      created.ownerDocument = document;
      return created;
    },
    listeners: new Map<string, Listener[]>(),
    addEventListener(type: string, listener: Listener) {
      const list = this.listeners.get(type) ?? [];
      list.push(listener);
      this.listeners.set(type, list);
    },
    removeEventListener(type: string, listener: Listener) {
      this.listeners.set(type, (this.listeners.get(type) ?? []).filter((item) => item !== listener));
    },
  };
  element.ownerDocument = document;
  body.ownerDocument = document;
  Object.defineProperty(globalThis, "document", { value: document, configurable: true });
  const windowListeners = new Map<string, Listener[]>();
  globalThis.addEventListener = ((type: string, listener: Listener) => {
    const list = windowListeners.get(type) ?? [];
    list.push(listener);
    windowListeners.set(type, list);
  }) as typeof globalThis.addEventListener;
  globalThis.removeEventListener = ((type: string, listener: Listener) => {
    windowListeners.set(type, (windowListeners.get(type) ?? []).filter((item) => item !== listener));
  }) as typeof globalThis.removeEventListener;
  if (typeof globalThis.window === "undefined") {
    Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  }
  if (typeof globalThis.HTMLIFrameElement !== "function") {
    Object.defineProperty(globalThis, "HTMLIFrameElement", {
      value: function HTMLIFrameElement() {},
      configurable: true,
    });
  }
  if (typeof globalThis.HTMLElement !== "function") {
    Object.defineProperty(globalThis, "HTMLElement", {
      value: function HTMLElement() {},
      configurable: true,
    });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

function matchesSelector(node: DomNode, selector: string): boolean {
  if (selector.startsWith("#")) return node.getAttribute("id") === selector.slice(1);
  const tag = selector.split(":")[0]?.trim().toUpperCase() ?? "";
  const attribute = selector.match(/^\[([^\]=]+)(?:=\"([^\"]*)\")?\]$/);
  if (attribute) {
    const value = node.getAttribute(attribute[1] ?? "");
    return attribute[2] === undefined ? value != null : value === attribute[2];
  }
  if (tag && node.tagName !== tag && node.nodeName !== tag) return false;
  if (selector.includes("not([disabled])") && (node.disabled || node.hasAttribute("disabled"))) return false;
  return tag.length > 0;
}

function componentHandlers(node: DomNode): {
  onChange?: (event: { target: { value: string } }) => void;
  onBlur?: (event: unknown) => void;
} {
  const key = Object.getOwnPropertyNames(node).find((name) => name.startsWith("__reactProps"));
  return (key ? (node as unknown as Record<string, unknown>)[key] : {}) as {
    onChange?: (event: { target: { value: string } }) => void;
    onBlur?: (event: unknown) => void;
  };
}

function eventFor(target: DomNode, type: string): EventLike {
  return {
    type,
    bubbles: true,
    cancelable: true,
    target,
    currentTarget: null,
    defaultPrevented: false,
    timeStamp: Date.now(),
    button: 0,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
    composedPath() {
      return [target];
    },
  };
}

function walk(node: DomNode, visit: (node: DomNode) => void): void {
  visit(node);
  for (const child of node.childNodes) walk(child, visit);
}

function find(predicate: (node: DomNode) => boolean): DomNode | undefined {
  let found: DomNode | undefined;
  walk(document.body as unknown as DomNode, (node) => {
    if (!found && predicate(node)) found = node;
  });
  return found;
}

function savedCart(): SellWorkspaceState {
  const base = createSellWorkspace({ createCartId: () => "cart-a", createLineId: () => "line-1" }, []);
  return {
    ...base,
    cartId: "cart-a",
    cartRevision: 1,
    lines: [{ lineId: "line-1", catalogItemId: "p1", name: "Tape", quantity: "1" }],
  };
}

function confirmedQuote(revision: number) {
  return {
    status: "confirmed" as const,
    revision,
    quote: { total: { minor: revision === 1 ? 100 : 200, currency: "GHS" } },
  };
}

afterEach(() => {
  document.body.textContent = "";
});

describe("cart save and checkout stay on one snapshot", () => {
  test("a held draft save blocks payment of a newer confirmed quote", async () => {
    installDocument();
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const drafts = createCartDraftStore(db);
    let releaseSave: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const prepare = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container as unknown as HTMLElement);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(createElement(SellScreen, {
        catalog: [],
        initialState: savedCart(),
        checkoutReady: true,
        quote: confirmedQuote(2),
        quoteCartId: "cart-a",
        quoteCustomerId: null,
        eligibility: { allowed: true },
        onPay: prepare,
        onWorkspaceChange: async (next) => {
          if (next.cartRevision > 1) await gate;
          await drafts.save(workspaceToCartDraft(next, "loc-a", "2026-10-12T12:00:00.000Z"));
        },
      }));
    });
    await act(async () => {
      await vi.waitFor(async () => {
        if ((await drafts.load("cart-a"))?.revision !== 1) throw new Error("the saved cart has not been written");
      });
    });
    const rootClicks = (container as unknown as DomNode).listeners.get("click")?.length ?? 0;
    if (rootClicks < 1) throw new Error(`root click listeners ${rootClicks}`);

    const increase = find((node) => node.getAttribute("aria-label") === "Increase quantity");
    expect(increase).toBeTruthy();
    await act(async () => {
      increase?.dispatchEvent(eventFor(increase!, "click"));
    });

    const quantity = find((node) => (node.getAttribute("class") ?? "").includes("qty-input"));
    expect(quantity?.value ?? quantity?.getAttribute("value")).not.toBe("2");
    expect((document.body as unknown as DomNode).textContent).toContain("Saving cart...");
    expect((document.body as unknown as DomNode).textContent).not.toContain("GHS 2.00");
    const pay = find((node) => (node.getAttribute("class") ?? "").includes("pay-btn"));
    expect(pay?.disabled === true || pay?.getAttribute("disabled") != null).toBe(true);
    await act(async () => {
      if (pay) {
        pay.disabled = false;
        pay.dispatchEvent(eventFor(pay, "click"));
      }
    });
    expect(prepare).not.toHaveBeenCalled();
    expect((await drafts.load("cart-a"))?.revision).toBe(1);

    releaseSave();
    await act(async () => {
      await vi.waitFor(() => {
        const input = find((node) => (node.getAttribute("class") ?? "").includes("qty-input"));
        if ((input?.value ?? input?.getAttribute("value")) !== "2") throw new Error("saved quantity is not visible");
      });
    });
    const stored = await drafts.load("cart-a");
    expect(stored?.revision).toBe(2);
    expect(stored?.lines[0]?.quantity).toBe("2");
    const restored = await restoreSellWorkspace({
      catalog: { search: async () => ({ ok: true, correlationId: "c", data: { items: [], nextCursor: undefined } }) },
      customers: { search: async () => ({ ok: true, correlationId: "c", data: [] }) },
      drafts,
      recallCartId: async () => "cart-a",
      browseCatalog: [],
      deps: { createCartId: () => "unused", createLineId: () => "unused" },
      availability: "fresh",
    });
    expect(restored.lines[0]?.quantity).toBe("2");
    expect(restored.cartRevision).toBe(2);
    root.unmount();
  });

  test("a rejected save stays visible, blocks payment, and can be retried", async () => {
    installDocument();
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const drafts = createCartDraftStore(db);
    const prepare = vi.fn();
    let fail = true;
    function Host() {
      const [quoteRevision, setQuoteRevision] = useState(2);
      return createElement(SellScreen, {
        catalog: [],
        initialState: savedCart(),
        checkoutReady: true,
        quote: confirmedQuote(quoteRevision),
        quoteCartId: "cart-a",
        quoteCustomerId: null,
        eligibility: { allowed: true },
        onPay: prepare,
        onCartDurable: () => setQuoteRevision(2),
        onWorkspaceChange: async (next) => {
          if (fail && next.cartRevision > 1) throw new Error("disk");
          await drafts.save(workspaceToCartDraft(next, "loc-a", "2026-10-12T12:00:00.000Z"));
        },
      });
    }
    const container = document.createElement("div");
    document.body.appendChild(container as unknown as HTMLElement);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(Host));
    });
    await act(async () => {
      await vi.waitFor(async () => {
        if (!(await drafts.load("cart-a"))) throw new Error("initial cart was not saved");
      });
    });
    const increase = find((node) => node.getAttribute("aria-label") === "Increase quantity");
    await act(async () => {
      increase?.dispatchEvent(eventFor(increase, "click"));
      await Promise.resolve();
    });
    await act(async () => {
      await vi.waitFor(() => {
        if (!(document.body as unknown as DomNode).textContent.includes("Couldn't save this cart. Try again.")) {
          throw new Error("save error is not visible");
        }
      });
    });
    expect(prepare).not.toHaveBeenCalled();
    expect((await drafts.load("cart-a"))?.revision).toBe(1);
    fail = false;
    const retry = find((node) => node.textContent === "Try again" && node.nodeName === "BUTTON");
    await act(async () => {
      retry?.dispatchEvent(eventFor(retry, "click"));
    });
    await act(async () => {
      await vi.waitFor(async () => {
        if ((await drafts.load("cart-a"))?.revision !== 2) throw new Error("retry did not save");
      });
    });
    expect(prepare).not.toHaveBeenCalled();
    root.unmount();
  });

  test("the same revision on another cart cannot be paid from this cart", async () => {
    installDocument();
    const prepare = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container as unknown as HTMLElement);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(SellScreen, {
        catalog: [],
        initialState: savedCart(),
        checkoutReady: true,
        quote: confirmedQuote(1),
        quoteCartId: "cart-b",
        quoteCustomerId: null,
        eligibility: { allowed: true },
        onPay: prepare,
        onWorkspaceChange: async () => undefined,
      }));
    });
    const pay = find((node) => (node.getAttribute("class") ?? "").includes("pay-btn"));
    expect(pay?.disabled === true || pay?.getAttribute("disabled") != null).toBe(true);
    await act(async () => {
      if (pay) {
        pay.disabled = false;
        pay.dispatchEvent(eventFor(pay, "click"));
      }
    });
    expect(prepare).not.toHaveBeenCalled();
    root.unmount();
  });

  test("a typed quantity stays on the saved value until that save finishes", async () => {
    installDocument();
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const drafts = createCartDraftStore(db);
    let releaseSave: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const prepare = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container as unknown as HTMLElement);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(SellScreen, {
        catalog: [],
        initialState: savedCart(),
        checkoutReady: true,
        quote: confirmedQuote(2),
        quoteCartId: "cart-a",
        quoteCustomerId: null,
        eligibility: { allowed: true },
        onPay: prepare,
        onWorkspaceChange: async (next) => {
          if (next.cartRevision > 1) await gate;
          await drafts.save(workspaceToCartDraft(next, "loc-a", "2026-10-12T12:00:00.000Z"));
        },
      }));
    });
    await act(async () => {
      await vi.waitFor(async () => {
        if ((await drafts.load("cart-a"))?.revision !== 1) throw new Error("the saved cart has not been written");
      });
    });
    const input = find((node) => (node.getAttribute("class") ?? "").includes("qty-input"));
    expect(input).toBeTruthy();
    await act(async () => {
      componentHandlers(input!).onChange?.({ target: { value: "2" } });
    });
    await act(async () => {
      componentHandlers(input!).onBlur?.({});
    });
    const committed = find((node) => (node.getAttribute("class") ?? "").includes("qty-input"));
    expect(committed?.value ?? committed?.getAttribute("value")).toBe("1");
    expect((document.body as unknown as DomNode).textContent).toContain("Saving cart...");
    const pay = find((node) => (node.getAttribute("class") ?? "").includes("pay-btn"));
    expect(pay?.disabled === true || pay?.getAttribute("disabled") != null).toBe(true);
    await act(async () => {
      if (pay) {
        pay.disabled = false;
        pay.dispatchEvent(eventFor(pay, "click"));
      }
    });
    expect(prepare).not.toHaveBeenCalled();
    expect((await drafts.load("cart-a"))?.lines[0]?.quantity).toBe("1");
    releaseSave();
    await act(async () => {
      await vi.waitFor(() => {
        const current = find((node) => (node.getAttribute("class") ?? "").includes("qty-input"));
        if ((current?.value ?? current?.getAttribute("value")) !== "2") throw new Error("typed quantity did not become the saved quantity");
      });
    });
    expect((await drafts.load("cart-a"))?.lines[0]?.quantity).toBe("2");
    root.unmount();
  });

  test("a customer change and a new cart with a repeated revision cannot use another cart's quote", async () => {
    installDocument();
    const db = openPosLocalDatabase(`cetech-pos-local-${crypto.randomUUID()}`);
    const drafts = createCartDraftStore(db);
    let releaseSave: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const prepare = vi.fn();
    const ama = { id: "customer-b", displayName: "Ama Mensah", kind: "retail" as const };
    const container = document.createElement("div");
    document.body.appendChild(container as unknown as HTMLElement);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(SellScreen, {
        catalog: [],
        customers: [ama],
        initialState: savedCart(),
        checkoutReady: true,
        quote: confirmedQuote(1),
        quoteCartId: "cart-a",
        quoteCustomerId: null,
        eligibility: { allowed: true },
        onPay: prepare,
        createCartId: () => "cart-b",
        createLineId: () => "line-b",
        onWorkspaceChange: async (next) => {
          if (next.selectedCustomer?.id === "customer-b") await gate;
          await drafts.save(workspaceToCartDraft(next, "loc-a", "2026-10-12T12:00:00.000Z"));
        },
      }));
    });
    await act(async () => {
      await vi.waitFor(async () => {
        if ((await drafts.load("cart-a"))?.revision !== 1) throw new Error("the saved cart has not been written");
      });
    });
    const chip = find((node) => (node.getAttribute("class") ?? "").includes("customer-chip"));
    await act(async () => {
      chip?.dispatchEvent(eventFor(chip, "click"));
    });
    const amaButton = find((node) => node.nodeName === "BUTTON" && node.textContent.includes("Ama Mensah"));
    expect(amaButton).toBeTruthy();
    await act(async () => {
      amaButton?.dispatchEvent(eventFor(amaButton, "click"));
    });
    expect((document.body as unknown as DomNode).textContent).toContain("Saving cart...");
    expect((document.body as unknown as DomNode).textContent).toContain("Walk-in");
    const pay = find((node) => (node.getAttribute("class") ?? "").includes("pay-btn"));
    expect(pay?.disabled === true || pay?.getAttribute("disabled") != null).toBe(true);
    await act(async () => {
      if (pay) {
        pay.disabled = false;
        pay.dispatchEvent(eventFor(pay, "click"));
      }
    });
    expect(prepare).not.toHaveBeenCalled();
    const before = await drafts.load("cart-a");
    expect(before && before.customer.kind !== "walkin" ? before.customer.customerId : undefined).toBeUndefined();
    releaseSave();
    await act(async () => {
      await vi.waitFor(async () => {
        const stored = await drafts.load("cart-a");
        const customerId = stored && stored.customer.kind !== "walkin" ? stored.customer.customerId : undefined;
        if (customerId !== "customer-b") throw new Error("customer was not saved");
      });
    });
    expect((document.body as unknown as DomNode).textContent).toContain("Ama Mensah");

    const clear = find((node) => (node.getAttribute("class") ?? "").includes("cart-clear"));
    await act(async () => {
      clear?.dispatchEvent(eventFor(clear!, "click"));
    });
    const confirm = find((node) => node.nodeName === "BUTTON" && node.textContent.includes("Clear sale"));
    expect(confirm).toBeTruthy();
    await act(async () => {
      confirm?.dispatchEvent(eventFor(confirm!, "click"));
    });
    await act(async () => {
      await vi.waitFor(async () => {
        if ((await drafts.load("cart-b"))?.revision !== 0) throw new Error("the replacement cart was not saved");
      });
    });
    const panel = find((node) => node.getAttribute("aria-label") === "Current sale");
    expect(panel?.getAttribute("data-cart-revision")).toBe("0");
    expect((document.body as unknown as DomNode).textContent).not.toContain("Tape");
    const repeated = find((node) => (node.getAttribute("class") ?? "").includes("pay-btn"));
    expect(repeated?.disabled === true || repeated?.getAttribute("disabled") != null).toBe(true);
    await act(async () => {
      if (repeated) {
        repeated.disabled = false;
        repeated.dispatchEvent(eventFor(repeated, "click"));
      }
    });
    expect(prepare).not.toHaveBeenCalled();
    root.unmount();
  });
});
