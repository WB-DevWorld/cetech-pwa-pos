"use client";

import { useState, type KeyboardEvent } from "react";
import { commitQuantityDraft, holdQuantityDraft, restoreQuantityDraft } from "../state/quantityDraft";
import { describePayButton, type CheckoutEligibilityView, type QuoteDisplayState } from "../state/quotePresentation";
import type { CartLineView, CustomerSearchResultView } from "../state/sellView";
import { QuoteStatus } from "./QuoteStatus";

export function CartLineRow({
  line,
  onIncrement,
  onDecrement,
  onQuantityChange,
  onRemove,
}: {
  line: CartLineView;
  onIncrement: (lineId: string) => void;
  onDecrement: (lineId: string) => void;
  onQuantityChange: (lineId: string, quantity: string) => void;
  onRemove: (lineId: string) => void;
}) {
  const [draft, setDraft] = useState(line.quantity);
  const [error, setError] = useState<string | null>(null);
  const [seenQuantity, setSeenQuantity] = useState(line.quantity);
  if (line.quantity !== seenQuantity) {
    setSeenQuantity(line.quantity);
    setDraft(line.quantity);
    setError(null);
  }

  function commit() {
    const result = commitQuantityDraft(draft, line.quantity);
    if (result.kind === "invalid") {
      setError(result.message);
      return;
    }
    setDraft(result.quantity);
    setError(null);
    if (result.kind === "commit") {
      onQuantityChange(line.lineId, result.quantity);
    }
  }

  function onDraftKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(restoreQuantityDraft(line.quantity));
      setError(null);
    }
  }

  const errorId = `qty-error-${line.lineId}`;

  return (
    <article className="cart-line">
      <div className="cart-line-title">
        <div>
          <div className="cart-line-name">{line.name}</div>
          {line.variationLabel ? <div className="muted">{line.variationLabel}</div> : null}
          {line.sku ? <div className="muted">{line.sku}</div> : null}
          {line.scannedBarcode ? <div className="muted">Barcode {line.scannedBarcode}</div> : null}
        </div>
      </div>
      <div className="qty-row">
        <div className="qty-control">
          <button type="button" className="btn" aria-label="Decrease quantity" onClick={() => onDecrement(line.lineId)}>
            −
          </button>
          <label className="sr-only" htmlFor={`qty-${line.lineId}`}>
            Quantity
          </label>
          <input
            id={`qty-${line.lineId}`}
            className="qty-input"
            inputMode="decimal"
            value={draft}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setDraft(holdQuantityDraft(event.target.value));
              setError(null);
            }}
            onBlur={commit}
            onKeyDown={onDraftKeyDown}
          />
          <button type="button" className="btn" aria-label="Increase quantity" onClick={() => onIncrement(line.lineId)}>
            +
          </button>
        </div>
        <button type="button" className="btn" onClick={() => onRemove(line.lineId)}>
          Remove
        </button>
      </div>
      {error ? (
        <div id={errorId} className="qty-error" role="alert">
          {error}
        </div>
      ) : null}
    </article>
  );
}

function CustomerChipLabel({ customer }: { customer: CustomerSearchResultView | null }) {
  if (!customer) return <span>Walk-in</span>;
  return (
    <span>
      {customer.displayName}
      {customer.kind === "b2b" ? (
        <>
          <br />
          <span className="sell-context-badge">Wholesale</span>
        </>
      ) : null}
    </span>
  );
}

export function CartPanel({
  revision,
  lines,
  customer,
  mobileOpen,
  onOpenCustomers,
  onNewSale,
  onIncrement,
  onDecrement,
  onQuantityChange,
  onRemove,
  onCloseMobile,
  quote,
  eligibility,
}: {
  revision: number;
  lines: readonly CartLineView[];
  customer: CustomerSearchResultView | null;
  mobileOpen: boolean;
  onOpenCustomers: () => void;
  onNewSale: () => void;
  onIncrement: (lineId: string) => void;
  onDecrement: (lineId: string) => void;
  onQuantityChange: (lineId: string, quantity: string) => void;
  onRemove: (lineId: string) => void;
  onCloseMobile: () => void;
  quote?: QuoteDisplayState;
  eligibility?: CheckoutEligibilityView;
}) {
  const pay = describePayButton(eligibility);
  return (
    <aside className={mobileOpen ? "cart-panel mobile-open" : "cart-panel"} aria-label="Current cart">
      <div className="cart-head">
        <div className="cart-head-row">
          <div>
            <strong>Cart</strong>
            <span className="muted"> · Rev {revision}</span>
          </div>
          <div className="cart-head-actions">
            <button type="button" className="btn cart-back" onClick={onCloseMobile}>
              Back
            </button>
            <button type="button" className="btn" onClick={onNewSale}>
              New sale
            </button>
          </div>
        </div>
        <button type="button" className="customer-chip" onClick={onOpenCustomers}>
          <span>
            <span className="eyebrow">Customer</span>
            <br />
            <CustomerChipLabel customer={customer} />
          </span>
          <span aria-hidden="true">›</span>
        </button>
        {quote ? (
          <QuoteStatus quote={quote} />
        ) : (
          <div className="quote-status">
            {lines.length === 0
              ? "Prices will be confirmed after an item is added."
              : "Price confirmation is required before payment."}
          </div>
        )}
      </div>
      <div className="cart-lines">
        {lines.length === 0 ? (
          <div className="empty-cart">
            <strong>Your cart is empty</strong>
            <div>Scan a barcode or choose a product to start selling.</div>
          </div>
        ) : (
          lines.map((line) => (
            <CartLineRow
              key={line.lineId}
              line={line}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onQuantityChange={onQuantityChange}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
      <div className="cart-footer">
        <button className="btn primary block pay-btn" type="button" disabled>
          Pay
        </button>
        {eligibility ? (
          <div
            className="muted pay-reason"
            data-eligibility-allowed={pay.eligibilityAllowed ? "true" : "false"}
            data-eligibility-reason={pay.eligibilityReason}
          >
            {pay.reason}
          </div>
        ) : (
          <div className="muted pay-reason">Checkout is unavailable until prices are confirmed.</div>
        )}
      </div>
    </aside>
  );
}
