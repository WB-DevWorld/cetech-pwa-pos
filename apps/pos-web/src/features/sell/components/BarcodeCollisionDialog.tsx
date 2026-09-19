"use client";

import { formatProductDisplayPrice } from "../state/variableDisplayPrice";
import { formatMoneyDisplay } from "../state/quotePresentation";
import type { SellProductView } from "../state/sellView";
import { SellModal } from "./SellModal";

function candidateDetail(item: SellProductView): string {
  const parts: string[] = [];
  if (item.variationLabel) parts.push(item.variationLabel);
  if (item.sku) parts.push(item.sku);
  const price = formatProductDisplayPrice(
    item.priceView ?? (item.displayPrice ? { kind: "single", amount: item.displayPrice } : undefined),
    formatMoneyDisplay,
  );
  if (price && price !== "Price unavailable") parts.push(price);
  return parts.join(" · ") || "Choose this item";
}

export function BarcodeCollisionDialog({
  barcode,
  matches,
  onSelect,
  onCancel,
}: {
  barcode: string;
  matches: readonly SellProductView[];
  onSelect: (item: SellProductView) => void;
  onCancel: () => void;
}) {
  return (
    <SellModal titleId="collision-dialog-title" onClose={onCancel} showClose closeLabel="Close duplicate barcode match">
      <h2 id="collision-dialog-title" tabIndex={-1}>
        Duplicate barcode match
      </h2>
      <div className="banner warning collision-warning" role="alert">
        <strong>Barcode collision detected.</strong>
        <span>More than one sellable item uses this barcode. Choose an item instead of guessing.</span>
      </div>
      <p className="sr-only">Barcode {barcode}</p>
      <div className="collision-list">
        {matches.map((item) => (
          <button key={item.id} type="button" className="btn block collision-candidate" onClick={() => onSelect(item)}>
            <span className="dialog-choice">
              <strong>{item.name}</strong>
              <span className="muted">{candidateDetail(item)}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </SellModal>
  );
}
