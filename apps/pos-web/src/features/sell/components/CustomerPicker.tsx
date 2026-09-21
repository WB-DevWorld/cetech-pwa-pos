"use client";

import { useEffect, useMemo, useState } from "react";
import { customerSecondaryText, filterCustomerResults } from "../state/customerSearch";
import type { CustomerSearchResultView } from "../state/sellView";
import { SellModal } from "./SellModal";

export function CustomerPicker({
  customers,
  selectedId,
  onSelect,
  onClear,
  onCancel,
  onQueryChange,
}: {
  customers: readonly CustomerSearchResultView[];
  selectedId: string | null;
  onSelect: (customer: CustomerSearchResultView) => void;
  onClear: () => void;
  onCancel: () => void;
  onQueryChange?: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => filterCustomerResults(customers, query), [customers, query]);

  useEffect(() => {
    if (!onQueryChange) return;
    const timer = window.setTimeout(() => onQueryChange(query), 250);
    return () => window.clearTimeout(timer);
  }, [onQueryChange, query]);

  return (
    <SellModal titleId="customer-picker-title" onClose={onCancel}>
      <h2 id="customer-picker-title">Select customer</h2>
      <div className="field">
        <label htmlFor="customer-search">Search customers</label>
        <input
          id="customer-search"
          className="input"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search name, company, phone…"
          autoComplete="off"
        />
      </div>
      <div className="customer-list">
        <button type="button" className={selectedId === null ? "btn block selected" : "btn block"} onClick={onClear}>
          <span className="dialog-choice">
            <strong>Walk-in</strong>
            <span className="muted">Continue without a customer account</span>
          </span>
        </button>
        {results.map((customer) => {
          const secondary = customerSecondaryText(customer);
          return (
            <button
              key={customer.id}
              type="button"
              className={selectedId === customer.id ? "btn block selected" : "btn block"}
              onClick={() => onSelect(customer)}
            >
              <span className="dialog-choice">
                <strong>{customer.displayName}</strong>
                {secondary ? <span className="muted">{secondary}</span> : null}
                {customer.kind === "b2b" ? <span className="sell-context-badge">Wholesale</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </SellModal>
  );
}
