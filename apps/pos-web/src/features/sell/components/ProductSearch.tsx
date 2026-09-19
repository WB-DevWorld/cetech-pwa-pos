"use client";

import type { FormEvent } from "react";
import { skuLabel } from "../../../ui/cashier-language";
import { formatMoneyDisplay } from "../state/quotePresentation";
import { productBadges, productStockCopy, stockStatusClass } from "../state/productPresentation";
import { formatProductDisplayPrice } from "../state/variableDisplayPrice";
import type { SellProductView } from "../state/sellView";
import { ProductBadgeList } from "./ProductBadge";

export function ProductSearch({
  query,
  onQueryChange,
  onSearchSubmit,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onSearchSubmit: (query: string) => void;
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
          Barcode, SKU or product name
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
  const stock = productStockCopy(item);
  const badges = productBadges(item);
  const priceView = item.priceView ?? (item.displayPrice ? { kind: "single" as const, amount: item.displayPrice } : undefined);
  const price = formatProductDisplayPrice(priceView, formatMoneyDisplay, {
    treatMissingAsUnavailable: item.kind === "variable",
  });
  return (
    <button
      type="button"
      className="product-card"
      onClick={() => onSelect(item)}
      disabled={out}
      aria-label={item.name}
      title={item.name}
    >
      <ProductBadgeList badges={badges} />
      <div className="product-name">{item.name}</div>
      {skuLabel(item.sku) ? <div className="product-sku muted">{skuLabel(item.sku)}</div> : null}
      <div className={stockStatusClass(item.stockStatus)}>{stock.text}</div>
      {priceView?.kind === "range" ? (
        <div
          className="product-price product-price-range"
          data-product-display-price={price ?? undefined}
          aria-label={price ?? undefined}
        >
          <span className="product-price-amount">{formatMoneyDisplay(priceView.min)}</span>
          <span aria-hidden="true"> – </span>
          <span className="product-price-amount">{formatMoneyDisplay(priceView.max)}</span>
        </div>
      ) : price ? (
        <div
          className={`product-price${price === "Price unavailable" ? " product-price-unavailable" : ""}`}
          data-product-display-price={price}
        >
          {price}
        </div>
      ) : (
        <div className="product-price product-price-empty" />
      )}
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
