import type {
  PreparedSale,
  QuoteLine,
  ReceiptLine,
  SaleResolution,
} from "../../../../../docs/contracts/domain.generated";
import type {
  PrepareIntent,
  StoredQuoteSnapshot,
} from "../../core/checkout/supabase-store";
import type { SeedPreparedSaleInput, StoredDevice, StoredRegister, StoredShift } from "../../core/checkout/types";

export function buildPreparedSaleSeed(input: {
  readonly snapshot: StoredQuoteSnapshot;
  readonly intent: PrepareIntent;
  readonly prepared: PreparedSale;
  readonly register: StoredRegister;
  readonly device: StoredDevice;
  readonly shift: StoredShift;
}): SeedPreparedSaleInput {
  const { snapshot, intent, prepared, register, device, shift } = input;
  const quote = snapshot.quote;
  return {
    organizationId: intent.organizationId,
    locationId: intent.locationId,
    locationName: snapshot.locationName,
    registerId: register.id,
    registerName: register.name,
    deviceId: device.id,
    shiftId: shift.id,
    cashierId: intent.cashierId,
    cashierName: intent.cashierName,
    customer: quote.customer,
    customerLabel:
      quote.customer.kind === "walkin" ? "Walk-in customer" : quote.customer.customerId,
    prepared,
    lines: quote.lines.map(toReceiptLine),
    subtotal: quote.subtotal,
    discount: quote.discount,
    tax: quote.tax,
  };
}

export function reconstructPreparedSale(input: {
  readonly snapshot: StoredQuoteSnapshot;
  readonly intent: PrepareIntent;
  readonly resolution: SaleResolution;
}): PreparedSale | undefined {
  const { snapshot, intent, resolution } = input;
  if (!resolution.saleId || !resolution.orderReference) {
    return undefined;
  }
  return {
    transactionId: intent.request.transactionId,
    saleId: resolution.saleId,
    orderReference: resolution.orderReference,
    quoteFingerprint: snapshot.quote.fingerprint,
    total: snapshot.quote.total,
    status: "prepared",
    stockCommitment: "reserved",
    preparedAt: intent.createdAt,
    expiresAt: snapshot.quote.expiresAt,
  };
}

function toReceiptLine(line: QuoteLine): ReceiptLine {
  return {
    name: line.productId,
    ...(line.variationId ? { variationLabel: line.variationId } : {}),
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    subtotal: line.subtotal,
    discount: line.discount,
    tax: line.tax,
    total: line.total,
  };
}
