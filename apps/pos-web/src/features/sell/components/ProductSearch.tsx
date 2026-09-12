"use client";

import type { FormEvent } from "react";
import type { SellProductView } from "../state/sellView";

export function ProductSearch({
  query,
  onQueryChange,
  onSearchSubmit,
  onScan,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onSearchSubmit: (query: string) => void;
  onScan: (query: string) => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearchSubmit(query);
  }

  return (
    <form className="product-toolbar" onSubmit={handleSubmit}>
      <div className="search-box">
        <span className="search-icon" aria-hidden="true">
          ⌕
        </span>
        <label className="sr-only" htmlFor="product-search">
          Scan barcode or search products
        </label>
        <input
          className="input"
          id="product-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Scan barcode or search products, SKU…"
          autoComplete="off"
          inputMode="text"
        />
      </div>
      <button className="btn" type="button" onClick={() => onScan(query)}>
        Scan
      </button>
      <button
        className="btn desktop-only"
        type="button"
        title="Shortcut: F2 / Ctrl+K"
        onClick={() => document.getElementById("product-search")?.focus()}
      >
        F2 Search
      </button>
    </form>
  );
}

export function ProductCard({
  item,
  onSelect,
}: {
  item: SellProductView;
  onSelect: (item: SellProductView) => void;
}) {
  const out = item.stockStatus === "out_of_stock";
  const stockText =
    item.stockStatus === "out_of_stock"
      ? "Out of stock"
      : item.stockStatus === "low_stock"
        ? "Low stock"
        : item.stockStatus === "backorder"
          ? "Backorder"
          : item.stockStatus === "in_stock"
            ? "In stock"
            : "Stock unknown";
  const stockClass =
    out ? "stock-line out" : item.stockStatus === "low_stock" || item.stockStatus === "backorder" ? `stock-line ${item.stockStatus === "backorder" ? "backorder" : "low"}` : "stock-line";
  return (
    <button
      type="button"
      className="product-card"
      onClick={() => onSelect(item)}
      disabled={out}
      aria-label={item.name}
    >
      <div className="product-name">{item.name}</div>
      {item.sku ? <div className="muted">{item.sku}</div> : null}
      <div className={stockClass}>
        {stockText}
      </div>
    </button>
  );
}

export function ProductResults({
  items,
  onSelect,
}: {
  items: readonly SellProductView[];
  onSelect: (item: SellProductView) => void;
}) {
  if (items.length === 0) {
    return <p className="muted">No products match this search.</p>;
  }
  return (
    <div className="product-results">
      <div className="product-grid">
        {items.map((item) => (
          <ProductCard key={item.id} item={item} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
