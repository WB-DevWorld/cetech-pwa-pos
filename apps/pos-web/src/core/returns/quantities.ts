import type { Money, NonNegativeQuantity, Quantity } from "../../../../../docs/contracts/domain.generated";

const SCALE = 1_000_000;

export function parseQuantity(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("invalid quantity");
  }
  return parsed;
}

export function formatQuantity(value: number): Quantity {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("quantity must be positive");
  }
  return formatDecimal(value) as Quantity;
}

export function formatNonNegativeQuantity(value: number): NonNegativeQuantity {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("quantity must be non-negative");
  }
  if (value === 0) {
    return "0";
  }
  return formatDecimal(value) as NonNegativeQuantity;
}

export function quantityLte(left: number, right: number): boolean {
  return toMicros(left) <= toMicros(right);
}

export function allocateHistoricMinor(input: {
  readonly historicalTotal: Money;
  readonly originalSold: number;
  readonly previouslyReturned: number;
  readonly requested: number;
}): number {
  const original = toMicros(input.originalSold);
  const previous = toMicros(input.previouslyReturned);
  const requested = toMicros(input.requested);
  if (original <= BigInt(0) || requested <= BigInt(0) || previous + requested > original) {
    return -1;
  }
  const total = BigInt(input.historicalTotal.minor);
  if (previous + requested === original) {
    return Number(total - (total * previous) / original);
  }
  return Number((total * requested) / original);
}

function formatDecimal(value: number): string {
  const scaled = Math.round(value * SCALE) / SCALE;
  if (Number.isInteger(scaled)) {
    return String(scaled);
  }
  return scaled.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function toMicros(value: number): bigint {
  return BigInt(Math.round(value * SCALE));
}
