import "fake-indexeddb/auto";
import { createElement, StrictMode, useLayoutEffect, useState, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Quote } from "../../../../../../docs/contracts/domain.generated";
import { POS_LOCAL_DB_NAME, openPosLocalDatabase } from "../../../local";
import type { CashCheckoutPorts } from "./cashCheckoutController";
import { createCheckoutAttemptStore, discardCheckoutAttemptMemory } from "./checkout-attempt-store";
import { useCashCheckout } from "./useCashCheckout";

type CheckoutApi = ReturnType<typeof useCashCheckout>;

const reactWarnings: string[] = [];
const originalConsoleError = console.error;

function quote(): Quote {
  return {
    id: "quote-live-1",
    fingerprint: "fp-live-1",
    cartId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    cartRevision: 1,
    customer: { kind: "walkin" },
    locationId: "loc-front-1",
    currency: "GHS",
    lines: [],
    subtotal: { minor: 1500, currency: "GHS" },
    discount: { minor: 0, currency: "GHS" },
    tax: { minor: 0, currency: "GHS" },
    total: { minor: 1500, currency: "GHS" },
    calculatedAt: "2026-09-13T20:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    purchasable: true,
  };
}

function ports(prepare: CashCheckoutPorts["checkout"]["prepare"], registerId: string, sequenceStart: number): CashCheckoutPorts {
  let n = sequenceStart;
  const next = () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
  return {
    checkout: { prepare, finalize: vi.fn() },
    payments: { confirmCash: vi.fn(), resolve: vi.fn() },
    sales: { resolve: vi.fn(), cancel: vi.fn() },
    receipts: { getByTransaction: vi.fn() },
    printer: { print: vi.fn() },
    scope: { registerId, shiftId: "shift-1", deviceId: "device-1" },
    createUuid: next,
  };
}

function hangingPrepare() {
  return vi.fn(() => new Promise<never>(() => undefined));
}

function sentPrepare(mock: object): { transactionId: string; idempotencyKey: string } {
  const call = (mock as { mock: { calls: ReadonlyArray<ReadonlyArray<unknown>> } }).mock.calls[0];
  const body = call?.[0];
  const context = call?.[1];
  if (!body || typeof body !== "object" || !("transactionId" in body) || typeof body.transactionId !== "string") {
    throw new Error("prepare was not called");
  }
  const idempotencyKey =
    context && typeof context === "object" && "idempotencyKey" in context && typeof context.idempotencyKey === "string"
      ? context.idempotencyKey
      : "";
  return { transactionId: body.transactionId, idempotencyKey };
}

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

function CheckoutHost({
  initial,
  sinkRef,
}: {
  initial: CashCheckoutPorts;
  sinkRef: { current: CheckoutApi | null; replace: (next: CashCheckoutPorts) => void };
}) {
  const [currentPorts, setCurrentPorts] = useState(initial);
  const checkout = useCashCheckout(currentPorts);
  useLayoutEffect(() => {
    sinkRef.current = checkout;
    sinkRef.replace = (next) => {
      setCurrentPorts(next);
    };
  });
  return createElement("p", null, checkout.ready ? "ready" : "gated");
}

async function finishHydration(sink: { current: CheckoutApi | null }): Promise<void> {
  await act(async () => {
    await vi.waitFor(() => {
      if (!sink.current?.ready) {
        throw new Error("checkout attempt store is still hydrating");
      }
    });
  });
}

function renderCheckout(initial: CashCheckoutPorts): { root: Root; sink: { current: CheckoutApi | null; replace: (next: CashCheckoutPorts) => void } } {
  installTestDocument();
  const container = document.createElement("div");
  document.body.appendChild(container as unknown as HTMLElement);
  const root = createRoot(container);
  const sinkRef: { current: CheckoutApi | null; replace: (next: CashCheckoutPorts) => void } = {
    current: null,
    replace: () => undefined,
  };
  flushSync(() => {
    root.render(createElement(StrictMode, null, createElement(CheckoutHost, { initial, sinkRef })));
  });
  return { root, sink: sinkRef };
}

beforeEach(async () => {
  reactWarnings.length = 0;
  console.error = (...args: unknown[]) => {
    reactWarnings.push(args.map((item) => String(item)).join(" "));
    originalConsoleError(...args);
  };
  discardCheckoutAttemptMemory(POS_LOCAL_DB_NAME);
  await openPosLocalDatabase().kv.delete("checkout.active-business-attempt");
  discardCheckoutAttemptMemory(POS_LOCAL_DB_NAME);
});

afterEach(() => {
  console.error = originalConsoleError;
  const blocked = reactWarnings.filter((line) =>
    /maximum update depth|while rendering a different component|Cannot update a component|setState.*render|Too many re-renders/i.test(line),
  );
  expect(blocked).toEqual([]);
});

describe("useCashCheckout runtime identity", () => {
  test("same-scope ports refresh does not mint a second prepare", async () => {
    const prepare = hangingPrepare();
    const { root, sink } = renderCheckout(ports(prepare, "reg_a", 0));
    await finishHydration(sink);
    expect(sink.current?.ready).toBe(true);
    await act(async () => {
      void sink.current?.startPrepare(quote());
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    const sent = sentPrepare(prepare);
    const refreshed = hangingPrepare();
    await act(async () => {
      sink.replace(ports(refreshed, "reg_a", 100));
    });
    await act(async () => {
      void sink.current?.startPrepare(quote());
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(refreshed).not.toHaveBeenCalled();
    expect(sink.current?.session.transactionId).toBe(sent.transactionId);
    expect(sent.idempotencyKey).not.toBe("");
    await act(async () => {
      root.unmount();
    });
  });

  test("remount restores the unresolved attempt from IndexedDB", async () => {
    const prepare = hangingPrepare();
    const first = renderCheckout(ports(prepare, "reg_a", 0));
    await finishHydration(first.sink);
    await act(async () => {
      void first.sink.current?.startPrepare(quote());
    });
    const transactionId = sentPrepare(prepare).transactionId;
    await vi.waitFor(async () => {
      expect(await openPosLocalDatabase().kv.get("checkout.active-business-attempt")).toBeTruthy();
    });
    await act(async () => {
      first.root.unmount();
    });
    discardCheckoutAttemptMemory(POS_LOCAL_DB_NAME);
    const again = hangingPrepare();
    const second = renderCheckout(ports(again, "reg_a", 100));
    await finishHydration(second.sink);
    expect(second.sink.current?.ready).toBe(true);
    expect(second.sink.current?.session.transactionId).toBe(transactionId);
    await act(async () => {
      void second.sink.current?.startPrepare(quote());
    });
    expect(again).not.toHaveBeenCalled();
    expect(prepare).toHaveBeenCalledTimes(1);
    await act(async () => {
      second.root.unmount();
    });
  });

  test("a register change does not mint while the first attempt is unresolved", async () => {
    const prepare = hangingPrepare();
    const { root, sink } = renderCheckout(ports(prepare, "reg_a", 0));
    await finishHydration(sink);
    await act(async () => {
      void sink.current?.startPrepare(quote());
    });
    const transactionId = sentPrepare(prepare).transactionId;
    const other = hangingPrepare();
    await act(async () => {
      sink.replace(ports(other, "reg_b", 100));
    });
    await act(async () => {
      void sink.current?.startPrepare(quote());
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    const stored = createCheckoutAttemptStore(openPosLocalDatabase()).readSync();
    expect(stored?.transactionId).toBe(transactionId);
    expect(stored?.registerId).toBe("reg_a");
    await act(async () => {
      root.unmount();
    });
  });

  test("pay stays closed until attempt hydration finishes, then restores the stored attempt", async () => {
    const db = openPosLocalDatabase();
    const seeded = "00000000-0000-4000-8000-000000000777";
    createCheckoutAttemptStore(db).write({
      transactionId: seeded,
      quoteId: "quote-live-1",
      quoteFingerprint: "fp-live-1",
      quoteTotalMinor: 1500,
      currency: "GHS",
      registerId: "reg_a",
      shiftId: "shift-1",
      deviceId: "device-1",
      prepareKey: "00000000-0000-4000-8000-000000000701",
      prepareCorrelationId: "00000000-0000-4000-8000-000000000702",
      cashKey: "00000000-0000-4000-8000-000000000703",
      cashCorrelationId: "00000000-0000-4000-8000-000000000704",
      finalizeKey: "00000000-0000-4000-8000-000000000705",
      finalizeCorrelationId: "00000000-0000-4000-8000-000000000706",
      stage: "preparing",
      saleCompleted: false,
      message: "Checking price and stock…",
    });
    await vi.waitFor(async () => {
      expect(await db.kv.get("checkout.active-business-attempt")).toBeTruthy();
    });
    discardCheckoutAttemptMemory(POS_LOCAL_DB_NAME);
    const prepare = hangingPrepare();
    const { root, sink } = renderCheckout(ports(prepare, "reg_a", 0));
    expect(sink.current?.ready).toBe(false);
    void sink.current?.startPrepare(quote());
    expect(prepare).not.toHaveBeenCalled();
    expect(sink.current?.session.transactionId).toBeUndefined();
    await finishHydration(sink);
    expect(sink.current?.ready).toBe(true);
    expect(sink.current?.session.transactionId).toBe(seeded);
    expect(prepare).not.toHaveBeenCalled();
    await act(async () => {
      root.unmount();
    });
  });
});
