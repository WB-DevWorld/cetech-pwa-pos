import type { CartLineView, SellProductView } from "./sellView";
import { decrementQuantity, incrementQuantity, parseQuantityInput } from "./quantity";

export type LineIdFactory = () => string;

export type CartSnapshot = {
  readonly cartId: string;
  readonly cartRevision: number;
  readonly lines: readonly CartLineView[];
};

function sameLine(line: CartLineView, catalogItemId: string, variationId?: string): boolean {
  return line.catalogItemId === catalogItemId && (line.variationId ?? "") === (variationId ?? "");
}

function bump(cart: CartSnapshot, lines: readonly CartLineView[]): CartSnapshot {
  return {
    cartId: cart.cartId,
    cartRevision: cart.cartRevision + 1,
    lines,
  };
}

export function lineIdentityFromItem(item: SellProductView): { catalogItemId: string; variationId?: string } {
  if (item.kind === "variation") {
    return {
      catalogItemId: item.parentId ?? item.id,
      variationId: item.id,
    };
  }
  return { catalogItemId: item.id };
}

export function addOrIncrementLine(
  cart: CartSnapshot,
  item: SellProductView,
  createLineId: LineIdFactory,
  scannedBarcode?: string,
): CartSnapshot {
  const identity = lineIdentityFromItem(item);
  const existing = cart.lines.find((line) => sameLine(line, identity.catalogItemId, identity.variationId));
  if (existing) {
    const nextQty = incrementQuantity(existing.quantity);
    if (!nextQty.ok) return cart;
    return bump(
      cart,
      cart.lines.map((line) => (line.lineId === existing.lineId ? { ...line, quantity: nextQty.quantity } : line)),
    );
  }
  const line: CartLineView = {
    lineId: createLineId(),
    catalogItemId: identity.catalogItemId,
    variationId: identity.variationId,
    name: item.kind === "variation" ? item.name : item.name,
    variationLabel: item.variationLabel,
    sku: item.sku,
    scannedBarcode,
    quantity: "1",
  };
  return bump(cart, [...cart.lines, line]);
}

export function setLineQuantity(cart: CartSnapshot, lineId: string, rawQuantity: string): CartSnapshot {
  const parsed = parseQuantityInput(rawQuantity);
  if (!parsed.ok) return cart;
  const existing = cart.lines.find((line) => line.lineId === lineId);
  if (!existing || existing.quantity === parsed.quantity) return cart;
  return bump(
    cart,
    cart.lines.map((line) => (line.lineId === lineId ? { ...line, quantity: parsed.quantity } : line)),
  );
}

export function incrementLine(cart: CartSnapshot, lineId: string): CartSnapshot {
  const existing = cart.lines.find((line) => line.lineId === lineId);
  if (!existing) return cart;
  const nextQty = incrementQuantity(existing.quantity);
  if (!nextQty.ok) return cart;
  return bump(
    cart,
    cart.lines.map((line) => (line.lineId === lineId ? { ...line, quantity: nextQty.quantity } : line)),
  );
}

export function decrementLine(cart: CartSnapshot, lineId: string): CartSnapshot {
  const existing = cart.lines.find((line) => line.lineId === lineId);
  if (!existing) return cart;
  const nextQty = decrementQuantity(existing.quantity);
  if (!nextQty.ok) {
    return removeLine(cart, lineId);
  }
  return bump(
    cart,
    cart.lines.map((line) => (line.lineId === lineId ? { ...line, quantity: nextQty.quantity } : line)),
  );
}

export function removeLine(cart: CartSnapshot, lineId: string): CartSnapshot {
  if (!cart.lines.some((line) => line.lineId === lineId)) return cart;
  return bump(
    cart,
    cart.lines.filter((line) => line.lineId !== lineId),
  );
}

export function emptyCart(cartId: string): CartSnapshot {
  return { cartId, cartRevision: 0, lines: [] };
}
