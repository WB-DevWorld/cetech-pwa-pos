"use client";

import { useMemo, useState } from "react";
import type { CustomerSummary } from "../../../../../docs/contracts/domain.generated";

export type CustomersWorkspaceState = "ready" | "loading" | "error" | "offline" | "degraded";

export interface CustomersScreenProps {
  readonly customers: readonly CustomerSummary[];
  readonly state?: CustomersWorkspaceState;
  readonly errorMessage?: string;
  readonly selectedCustomerId?: string;
  readonly onRetry?: () => void;
  readonly onUseCustomer?: (customer: CustomerSummary) => void;
  readonly onSearchQueryChange?: (query: string) => void;
}

export function CustomersScreen({
  customers,
  state = "ready",
  errorMessage,
  selectedCustomerId,
  onRetry,
  onUseCustomer,
  onSearchQueryChange,
}: CustomersScreenProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return customers;
    return customers.filter((customer) =>
      [customer.displayName, customer.company, customer.phoneMasked]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [customers, query]);

  return (
    <section className="customers-workspace workspace-surface" aria-labelledby="customers-title">
      <div className="page-head">
        <div>
          <h1 id="customers-title">Customers</h1>
          <p>Choose retail or wholesale customer context without exposing provider internals.</p>
        </div>
      </div>

      {state === "offline" ? (
        <div className="banner warning workspace-banner" role="status">
          <strong>Offline.</strong>
          <span>Walk-in sales remain the safe fallback. Cached customer details may be stale until connection returns.</span>
        </div>
      ) : null}
      {state === "degraded" ? (
        <div className="banner warning workspace-banner" role="status">
          <strong>Customer lookup is degraded.</strong>
          <span>Use only customer records already returned by the mounted customer source; do not infer wholesale pricing here.</span>
        </div>
      ) : null}
      {state === "error" ? (
        <div className="banner danger workspace-banner" role="alert">
          <strong>Customers could not be loaded.</strong>
          <span>{errorMessage ?? "Customer lookup is unavailable. Walk-in customer context remains available from Sell."}</span>
          {onRetry ? (
            <button className="btn small" type="button" onClick={onRetry}>Retry</button>
          ) : null}
        </div>
      ) : null}

      <div className="card card-pad customers-search-card">
        <label className="field" htmlFor="customer-workspace-search">
          <span>Search customers</span>
          <input
            id="customer-workspace-search"
            className="input"
            type="search"
            placeholder="Name, company or phone…"
            value={query}
            disabled={state === "error"}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              onSearchQueryChange?.(value);
            }}
          />
        </label>
      </div>

      {state === "loading" ? (
        <div className="card card-pad workspace-state" role="status" aria-live="polite">
          <div className="workspace-spinner" aria-hidden="true" />
          <div><strong>Loading customers…</strong><p>Walk-in context remains available from Sell.</p></div>
        </div>
      ) : null}

      {state !== "loading" && state !== "error" && filtered.length === 0 ? (
        <div className="card card-pad workspace-state" role="status">
          <div>
            <strong>{customers.length === 0 ? "No customers available." : "No customers match this search."}</strong>
            <p>{customers.length === 0 ? "The mounted customer source has not supplied retail or wholesale records." : "Try a different name, company, or phone."}</p>
          </div>
        </div>
      ) : null}

      {state !== "loading" && state !== "error" && filtered.length > 0 ? (
        <div className="customer-card-grid">
          {filtered.map((customer) => {
            const selected = selectedCustomerId === customer.id;
            return (
              <article className="card card-pad customer-card" key={customer.id} data-selected={selected ? "true" : "false"}>
                <div className="customer-card-heading">
                  <div>
                    <strong>{customer.displayName}</strong>
                    {customer.company ? <span className="workspace-subline">{customer.company}</span> : null}
                    {customer.phoneMasked ? <span className="workspace-subline">{customer.phoneMasked}</span> : null}
                  </div>
                  <span className={`workspace-badge ${customer.kind === "b2b" ? "info" : "neutral"}`}>
                    {customer.kind === "b2b" ? "Wholesale" : "Retail"}
                  </span>
                </div>
                {onUseCustomer ? (
                  <button
                    className={selected ? "btn primary" : "btn"}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onUseCustomer(customer)}
                  >
                    {selected ? "Selected for next sale" : "Use for next sale"}
                  </button>
                ) : (
                  <div className="muted">Selection is available after WS3 mounts the customer-to-Sell handoff.</div>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
