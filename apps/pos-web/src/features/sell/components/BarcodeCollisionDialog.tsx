"use client";

import type { SellProductView } from "../state/sellView";
import { SellModal } from "./SellModal";

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
    <SellModal titleId="collision-dialog-title" onClose={onCancel}>
      <h2 id="collision-dialog-title">Duplicate barcode match</h2>
      <div className="banner warning" role="alert">
        <div>
          <strong>Barcode collision detected.</strong> More than one sellable item uses barcode {barcode}. Choose an
          item instead of guessing.
        </div>
      </div>
      <div className="collision-list">
        {matches.map((item) => (
          <button key={item.id} type="button" className="btn block" onClick={() => onSelect(item)}>
            <span className="dialog-choice">
              <strong>{item.name}</strong>
              <span className="muted">{item.sku ?? item.id}</span>
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
