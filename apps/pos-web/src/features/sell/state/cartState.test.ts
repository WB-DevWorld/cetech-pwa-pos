import { describe, expect, test } from "vitest";
import { addOrIncrementLine, emptyCart, removeLine, setLineQuantity } from "./cartState";
import { SELL_TEST_CATALOG } from "./sellTestCatalog";

const simple = SELL_TEST_CATALOG.find((item) => item.id === "p-hardener")!;
const red = SELL_TEST_CATALOG.find((item) => item.id === "v-cable-red")!;
const black = SELL_TEST_CATALOG.find((item) => item.id === "v-cable-black")!;

function ids() {
  let n = 0;
  return () => `line-${++n}`;
}

describe("FE-03 cart state", () => {
  test("adding the first product creates a line and advances cartRevision", () => {
    const cart = addOrIncrementLine(emptyCart("cart-1"), simple, ids(), "0012345678901");
    expect(cart.cartRevision).toBe(1);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe("1");
    expect(cart.lines[0]?.scannedBarcode).toBe("0012345678901");
  });

  test("repeated same-line add increments quantity and revision", () => {
    const createLineId = ids();
    let cart = addOrIncrementLine(emptyCart("cart-1"), simple, createLineId, "0012345678901");
    cart = addOrIncrementLine(cart, simple, createLineId, "0012345678901");
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe("2");
    expect(cart.cartRevision).toBe(2);
  });

  test("distinct variations remain distinct cart lines", () => {
    const createLineId = ids();
    let cart = addOrIncrementLine(emptyCart("cart-1"), red, createLineId);
    cart = addOrIncrementLine(cart, black, createLineId);
    expect(cart.lines).toHaveLength(2);
    expect(cart.lines.map((line) => line.variationId)).toEqual(["v-cable-red", "v-cable-black"]);
    expect(cart.cartRevision).toBe(2);
  });

  test("quantity edit increments cartRevision", () => {
    let cart = addOrIncrementLine(emptyCart("cart-1"), simple, ids());
    const before = cart.cartRevision;
    cart = setLineQuantity(cart, cart.lines[0]!.lineId, "4");
    expect(cart.lines[0]?.quantity).toBe("4");
    expect(cart.cartRevision).toBe(before + 1);
  });

  test("line removal increments cartRevision", () => {
    let cart = addOrIncrementLine(emptyCart("cart-1"), simple, ids());
    const before = cart.cartRevision;
    cart = removeLine(cart, cart.lines[0]!.lineId);
    expect(cart.lines).toHaveLength(0);
    expect(cart.cartRevision).toBe(before + 1);
  });

  test("rejected Quantity overflow does not mutate the line or cartRevision", () => {
    const createLineId = ids();
    let cart = addOrIncrementLine(emptyCart("cart-1"), simple, createLineId, "0012345678901");
    cart = setLineQuantity(cart, cart.lines[0]!.lineId, "999999999");
    const before = cart.cartRevision;
    cart = addOrIncrementLine(cart, simple, createLineId, "0012345678901");
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]?.quantity).toBe("999999999");
    expect(cart.cartRevision).toBe(before);
  });
});
