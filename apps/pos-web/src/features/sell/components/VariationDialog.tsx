"use client";

import type { SellProductView } from "../state/sellView";
import { SellModal } from "./SellModal";

export function VariationDialog({
  product,
  variations,
  onSelect,
  onCancel,
}: {
  product: SellProductView;
  variations: readonly SellProductView[];
  onSelect: (variation: SellProductView) => void;
  onCancel: () => void;
}) {
  return (
    <SellModal titleId="variation-dialog-title" onClose={onCancel}>
      <h2 id="variation-dialog-title">Choose variation</h2>
      <p className="muted">Select the exact variation. Scanning a variation barcode bypasses this chooser.</p>
      {variations.length === 0 ? (
        <p className="muted">No selectable variations were supplied for {product.name}.</p>
      ) : (
        <div className="variation-list">
          {variations.map((variation) => (
            <button key={variation.id} type="button" className="btn block" onClick={() => onSelect(variation)}>
              <span className="dialog-choice">
                <strong>{variation.variationLabel ?? variation.name}</strong>
                <span className="muted">{variation.sku ?? variation.id}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </SellModal>
  );
}
