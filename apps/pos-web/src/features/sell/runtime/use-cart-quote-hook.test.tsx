import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Quote, QuoteRequest } from "../../../../../../docs/contracts/domain.generated";
import type { ApiResult, PricingPort } from "../../../../../../docs/contracts/ports";
import type { SellWorkspaceState } from "../state/sellView";
import { createSellWorkspace } from "../state/sellWorkspace";
import { useCartQuote, type UseCartQuoteInput } from "./useCartQuote";

function installTestDocument(): void {
  if (typeof globalThis.document !== "undefined") {
    return;
  }
  type TestNode = {
    nodeType: number;
    nodeName: string;
    tagName: string;
    nodeValue: string | null;
    textContent: string;
    ownerDocument: unknown;
    namespaceURI: string;
    parentNode: TestNode | null;
    childNodes: TestNode[];
    style: Record<string, string>;
    attributes: Record<string, string>;
    firstChild: TestNode | null;
    lastChild: TestNode | null;
    nextSibling: TestNode | null;
    previousSibling: TestNode | null;
    appendChild: (child: TestNode) => TestNode;
    insertBefore: (child: TestNode, before: TestNode | null) => TestNode;
    removeChild: (child: TestNode) => TestNode;
    setAttribute: (name: string, value: string) => void;
    getAttribute: (name: string) => string | null;
    removeAttribute: (name: string) => void;
    hasAttribute: (name: string) => boolean;
    addEventListener: () => void;
    removeEventListener: () => void;
    contains: (node: TestNode) => boolean;
  };
  const link = (node: TestNode) => {
    node.firstChild = node.childNodes[0] ?? null;
    node.lastChild = node.childNodes[node.childNodes.length - 1] ?? null;
    for (let index = 0; index < node.childNodes.length; index += 1) {
      const child = node.childNodes[index]!;
      child.parentNode = node;
      child.previousSibling = node.childNodes[index - 1] ?? null;
      child.nextSibling = node.childNodes[index + 1] ?? null;
    }
  };
  const create = (nodeType: number, nodeName: string): TestNode => {
    const node = {
      nodeType,
      nodeName,
      tagName: nodeName,
      nodeValue: null,
      textContent: "",
      ownerDocument: null as unknown,
      namespaceURI: "http://www.w3.org/1999/xhtml",
      parentNode: null,
      childNodes: [] as TestNode[],
      style: {},
      attributes: {},
      firstChild: null,
      lastChild: null,
      nextSibling: null,
      previousSibling: null,
      appendChild(child: TestNode) {
        if (child.parentNode) {
          child.parentNode.removeChild(child);
        }
        this.childNodes.push(child);
        link(this);
        return child;
      },
      insertBefore(child: TestNode, before: TestNode | null) {
        if (child.parentNode) {
          child.parentNode.removeChild(child);
        }
        const index = before ? this.childNodes.indexOf(before) : -1;
        if (index < 0) {
          this.childNodes.push(child);
        } else {
          this.childNodes.splice(index, 0, child);
        }
        link(this);
        return child;
      },
      removeChild(child: TestNode) {
        const index = this.childNodes.indexOf(child);
        if (index >= 0) {
          this.childNodes.splice(index, 1);
        }
        child.parentNode = null;
        link(this);
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
      addEventListener() {},
      removeEventListener() {},
      contains(target: TestNode) {
        if (target === this) {
          return true;
        }
        return this.childNodes.some((child) => child.contains(target));
      },
    } satisfies TestNode;
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
      created.nodeValue = text;
      created.textContent = text;
      created.ownerDocument = document;
      return created;
    },
    createComment(text: string) {
      const created = create(8, "#comment");
      created.nodeValue = text;
      created.ownerDocument = document;
      return created;
    },
    createDocumentFragment() {
      const created = create(11, "#fragment");
      created.ownerDocument = document;
      return created;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  element.ownerDocument = document;
  body.ownerDocument = document;
  Object.assign(document, {
    activeElement: null,
    addEventListener() {},
    removeEventListener() {},
  });
  Object.defineProperty(globalThis, "document", { value: document, configurable: true });
  if (typeof globalThis.window === "undefined") {
    Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
  }
  if (typeof globalThis.HTMLIFrameElement !== "function") {
    Object.defineProperty(globalThis, "HTMLIFrameElement", {
      value: function HTMLIFrameElement() {},
      configurable: true,
    });
  }
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
}

const roots: Root[] = [];
function workspace(): SellWorkspaceState {
  return { ...createSellWorkspace({ createCartId: () => "cart-a", createLineId: () => "line" }, []), cartRevision: 1,
    lines: [{ lineId: "line", catalogItemId: "product", name: "Fixture", quantity: "1" }] };
}
function quote(request: QuoteRequest, fingerprint = "fp-current"): Quote {
  const money = { minor: 100, currency: "GHS" };
  return { ...request, id: "quote-fixture", fingerprint, currency: "GHS",
    lines: request.lines.map((line) => ({ ...line, unitPrice: money, subtotal: money, discount: { ...money, minor: 0 },
      tax: { ...money, minor: 0 }, total: money, stockStatus: "in_stock", purchasable: true, problems: [] })),
    subtotal: money, discount: { ...money, minor: 0 }, tax: { ...money, minor: 0 }, total: money,
    calculatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), purchasable: true };
}
function pricingFixture() {
  const calls: { request: QuoteRequest; resolve: (value: ApiResult<Quote>) => void }[] = [];
  const pricing: PricingPort = { quote: vi.fn((request) => new Promise<ApiResult<Quote>>((resolve) => calls.push({ request, resolve }))) };
  return { calls, pricing, async answer(index: number, fingerprint?: string, expiresAt?: string) {
    const call = calls[index];
    if (!call) throw new Error("quote was not requested");
    await act(async () => { call.resolve({ ok: true, correlationId: "fixture", data: { ...quote(call.request, fingerprint), ...(expiresAt ? { expiresAt } : {}) } }); });
  } };
}
async function mounted(pricing: PricingPort, strict = false) {
  let input: UseCartQuoteInput = { pricing, workspace: workspace(), locationId: "location-a", online: true, shiftOpen: true, now: () => new Date() };
  let current: ReturnType<typeof useCartQuote> | undefined;
  function Probe({ value }: { value: UseCartQuoteInput }) { current = useCartQuote(value); return null; }
  const root = createRoot(document.createElement("div"));
  roots.push(root);
  async function render(next: Partial<UseCartQuoteInput> = {}) {
    input = { ...input, ...next };
    await act(async () => root.render(strict ? createElement(StrictMode, null, createElement(Probe, { value: input })) : createElement(Probe, { value: input })));
  }
  await render();
  return { get current() { if (!current) throw new Error("hook has not mounted"); return current; }, get input() { return input; }, render };
}

beforeEach(() => { installTestDocument(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T00:00:00.000Z")); });
afterEach(async () => { await act(async () => { for (const root of roots.splice(0)) root.unmount(); }); vi.useRealTimers(); });

describe("whole-cart quote commercial request binding", () => {
  test("a changed location fails Pay closed in the same render, before the remote replacement arrives", async () => {
    const f = pricingFixture(); const host = await mounted(f.pricing); await f.answer(0);
    expect(host.current.eligibility?.allowed).toBe(true);
    await host.render({ locationId: "location-b" });
    expect(host.current.quote?.status).toBe("quoting"); expect(host.current.confirmedQuote).toBeUndefined(); expect(host.current.eligibility?.allowed).toBe(false);
    expect(f.calls[1]?.request.locationId).toBe("location-b");
    await f.answer(1, "new-location-price");
    expect(host.current.quote?.status).toBe("confirmed"); expect(host.current.confirmedQuote?.locationId).toBe("location-b");
  });

  test.each([
    ["customer identity", { selectedCustomer: { id: "customer-b", displayName: "Fixture", kind: "retail" as const } }],
    ["B2B context", { selectedCustomer: { id: "customer-b", displayName: "Fixture", kind: "b2b" as const } }],
    ["quantity", { lines: [{ lineId: "line", catalogItemId: "product", name: "Fixture", quantity: "2" }] }],
    ["product", { lines: [{ lineId: "line", catalogItemId: "product-b", name: "Fixture", quantity: "1" }] }],
    ["variation", { lines: [{ lineId: "line", catalogItemId: "product", variationId: "variation-b", name: "Fixture", quantity: "1" }] }],
    ["line identity", { lines: [{ lineId: "line-b", catalogItemId: "product", name: "Fixture", quantity: "1" }] }],
  ] satisfies readonly (readonly [string, Partial<SellWorkspaceState>])[])("invalidates an old confirmed quote for changed %s even if the revision was retained", async (_dimension, changes) => {
    const f = pricingFixture(); const host = await mounted(f.pricing); await f.answer(0);
    await host.render({ workspace: { ...workspace(), ...changes } });
    expect(host.current.eligibility?.allowed).toBe(false); expect(host.current.confirmedQuote).toBeUndefined(); expect(f.calls).toHaveLength(2);
    await f.answer(1, "new-context-price"); expect(host.current.quote?.status).toBe("confirmed"); expect(host.current.eligibility?.allowed).toBe(true);
  });

  test("equivalent new presentation objects retain the current authority without another request", async () => {
    const f = pricingFixture(); const host = await mounted(f.pricing); await f.answer(0);
    await host.render({ workspace: { ...workspace(), lines: workspace().lines.map((line) => ({ ...line, name: "Updated presentation" })) } });
    expect(f.calls).toHaveLength(1); expect(host.current.eligibility?.allowed).toBe(true);
  });

  test("same complete request retry blocks Pay and preserves changed-fingerprint review", async () => {
    const f = pricingFixture(); const host = await mounted(f.pricing); await f.answer(0, "before");
    await act(async () => host.current.retry());
    expect(host.current.quote?.status).toBe("quoting"); expect(host.current.eligibility?.allowed).toBe(false);
    await f.answer(1, "after"); expect(host.current.quote?.status).toBe("changed"); expect(host.current.eligibility?.allowed).toBe(false);
  });

  test("old-context completion cannot replace a newer context or authorize Pay", async () => {
    const f = pricingFixture(); const host = await mounted(f.pricing);
    await host.render({ locationId: "location-b" }); await f.answer(1, "new"); await f.answer(0, "old");
    expect(host.current.confirmedQuote?.locationId).toBe("location-b"); expect(host.current.quote?.status).toBe("confirmed");
  });

  test("new cart at a lower revision never reuses or waits for the previous cart quote", async () => {
    const f = pricingFixture(); const host = await mounted(f.pricing);
    await host.render({ workspace: { ...workspace(), cartId: "cart-b", cartRevision: 0 } });
    expect(host.current.eligibility?.allowed).toBe(false); await f.answer(1); await f.answer(0);
    expect(host.current.confirmedQuote?.cartId).toBe("cart-b"); expect(host.current.confirmedQuote?.cartRevision).toBe(0);
  });

  test("offline and reconnect revalidation fail closed while preserving the exact request", async () => {
    const f = pricingFixture(); const host = await mounted(f.pricing); await f.answer(0);
    await host.render({ online: false }); expect(host.current.quote?.status).toBe("offline"); expect(host.current.eligibility?.allowed).toBe(false);
    await host.render({ online: true }); expect(host.current.quote?.status).toBe("quoting"); expect(host.current.eligibility?.allowed).toBe(false);
    expect(f.calls[1]?.request).toEqual(f.calls[0]?.request); await f.answer(1); expect(host.current.eligibility?.allowed).toBe(true);
  });

  test("an empty cart retires applicability and ignores its pending prior response", async () => {
    const f = pricingFixture(); const host = await mounted(f.pricing);
    await host.render({ workspace: { ...workspace(), lines: [] } }); await f.answer(0);
    expect(host.current.quote?.status).toBe("missing"); expect(host.current.eligibility?.allowed).toBe(false); expect(host.current.confirmedQuote).toBeUndefined();
  });

  test("expiry remains governed by current time without starting a hidden replacement quote", async () => {
    const f = pricingFixture(); const host = await mounted(f.pricing); await f.answer(0, "short", new Date(Date.now() + 500).toISOString());
    vi.setSystemTime(new Date(Date.now() + 501)); await host.render();
    expect(host.current.quote?.status).toBe("expired"); expect(host.current.eligibility?.allowed).toBe(false); expect(f.calls).toHaveLength(1);
  });

  test("pricing replacement ignores the old adapter completion", async () => {
    const first = pricingFixture(); const replacement = pricingFixture(); const host = await mounted(first.pricing);
    await host.render({ pricing: replacement.pricing }); await replacement.answer(0, "new-adapter"); await first.answer(0, "old-adapter");
    expect(host.current.confirmedQuote?.fingerprint).toBe("new-adapter");
  });

  test("Strict Mode effect rehearsal cannot apply cancelled responses", async () => {
    const f = pricingFixture(); const host = await mounted(f.pricing, true);
    expect(f.calls).toHaveLength(2); await f.answer(0, "cancelled"); expect(host.current.eligibility?.allowed).toBe(false);
    await f.answer(1, "current"); expect(host.current.confirmedQuote?.fingerprint).toBe("current");
  });

  test("unmount prevents pending remote completion from producing another render", async () => {
    const f = pricingFixture(); const host = await mounted(f.pricing); const before = host.current;
    await act(async () => roots.pop()?.unmount()); await f.answer(0);
    expect(host.current).toBe(before);
  });
});
