import type {
  Id,
  Quantity,
  ReturnCondition,
  ReturnConditionStockPolicy,
  StockDisposition,
  StockDispositionCommandLine,
} from "../../../../../docs/contracts/domain.generated";

export type MappedDisposition = {
  readonly intendedDisposition: StockDisposition;
  readonly dispositionPolicy: ReturnConditionStockPolicy;
};

/**
 * Conservative RT-01 mapping. No tenant numeric/threshold policy exists.
 * opened_resellable and defective fail closed to no_automatic_restock.
 */
export function mapConditionDisposition(condition: ReturnCondition): MappedDisposition {
  if (condition === "resellable") {
    return {
      intendedDisposition: "restock_sellable",
      dispositionPolicy: "automatic_sellable_restock",
    };
  }
  if (condition === "opened_resellable" || condition === "defective") {
    return {
      intendedDisposition: "no_automatic_restock",
      dispositionPolicy: "tenant_policy_required",
    };
  }
  return {
    intendedDisposition: "no_automatic_restock",
    dispositionPolicy: "mandatory_no_automatic_restock",
  };
}

export function stockEffectRequired(lines: readonly { readonly intendedDisposition: StockDisposition }[]): boolean {
  return lines.some((line) => line.intendedDisposition === "restock_sellable");
}

export function stockCommandLines(input: {
  readonly locationId: Id;
  readonly lines: readonly {
    readonly orderLineId: Id;
    readonly quantity: Quantity;
    readonly condition: ReturnCondition;
    readonly intendedDisposition: StockDisposition;
  }[];
}): readonly StockDispositionCommandLine[] {
  return input.lines
    .filter((line) => line.intendedDisposition === "restock_sellable")
    .map((line) => {
      if (line.condition !== "resellable") {
        throw new Error("sellable restock is only valid for resellable condition");
      }
      return {
        orderLineId: line.orderLineId,
        quantity: line.quantity,
        condition: "resellable" as const,
        disposition: "restock_sellable" as const,
        locationId: input.locationId,
      };
    });
}
