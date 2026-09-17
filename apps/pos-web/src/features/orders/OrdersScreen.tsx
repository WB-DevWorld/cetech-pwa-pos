"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Money } from "../../../../../docs/contracts/domain.generated";

export type OrdersWorkspaceState = "ready" | "loading" | "error" | "offline" | "degraded";
export type OrderWorkspaceStatus = "completed" | "refunded" | "partially_refunded" | "payment_pending" | "needs_attention" | "cancelled";

export interface OrderListItemView {
  readonly id: string;
  readonly orderReference: string;
  readonly receiptNumber?: string;
  readonly customerLabel: string;
  readonly customerKind?: "walkin" | "retail" | "b2b";
  readonly createdAt: string;
  readonly paymentLabel: string;
  readonly paymentStatus?: "verified" | "pending" | "failed" | "requires_attention";
  readonly total: Money;
  readonly status: OrderWorkspaceStatus;
  readonly transactionReference?: string;
}

export interface OrderDetailLineView {
  readonly id: string;
  readonly name: string;
  readonly quantity: string;
  readonly total: Money;
  readonly variationLabel?: string;
}

export interface OrderDetailView extends OrderListItemView {
  readonly cashierLabel?: string;
  readonly registerLabel?: string;
  readonly lines: readonly OrderDetailLineView[];
}

export interface OrderDetailDialogProps {
  readonly open: boolean;
  readonly order?: OrderDetailView;
  readonly canReturn?: boolean;
  readonly onClose: () => void;
  readonly onReprint?: (order: OrderDetailView) => void;
  readonly onStartReturn?: (order: OrderDetailView) => void;
}

export interface OrdersScreenProps {
  readonly orders: readonly OrderListItemView[];
  readonly state?: OrdersWorkspaceState;
  readonly errorMessage?: string;
  readonly onRetry?: () => void;
  readonly onSelectOrder?: (orderId: string) => void;
  readonly onNewSale?: () => void;
}

const STATUS_LABELS: Record<OrderWorkspaceStatus, string> = {
  completed: "Completed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  payment_pending: "Payment pending",
  needs_attention: "Needs attention",
  cancelled: "Cancelled",
};

function formatMoney(value: Money): string {
  const amount = value.minor / 100;
  const currency = value.currency === "GHS" ? "GHS" : value.currency;
  return `${currency} ${amount.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function badgeTone(status: OrderWorkspaceStatus | NonNullable<OrderListItemView["paymentStatus"]>): string {
  if (status === "completed" || status === "verified") return "success";
  if (status === "needs_attention" || status === "failed" || status === "requires_attention") return "danger";
  if (status === "refunded" || status === "partially_refunded" || status === "payment_pending" || status === "pending") return "warning";
  return "neutral";
}

export function OrdersScreen({
  orders,
  state = "ready",
  errorMessage,
  onRetry,
  onSelectOrder,
  onNewSale,
}: OrdersScreenProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | OrderWorkspaceStatus>("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      const matchesStatus = status === "all" || order.status === status;
      const haystack = [
        order.orderReference,
        order.receiptNumber,
        order.customerLabel,
        order.transactionReference,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return matchesStatus && (!needle || haystack.includes(needle));
    });
  }, [orders, query, status]);

  const unavailable = state === "error";

  return (
    <section className="orders-workspace workspace-surface" aria-labelledby="orders-title">
      <div className="page-head">
        <div>
          <h1 id="orders-title">Orders</h1>
          <p>Find sales, reprint receipts, and start returns.</p>
        </div>
        {onNewSale ? (
          <button className="btn" type="button" onClick={onNewSale}>
            New sale
          </button>
        ) : null}
      </div>

      {state === "offline" ? (
        <div className="banner warning workspace-banner" role="status">
          <strong>Offline.</strong>
          <span>Recent local records can stay visible, but authoritative order lookup and status require a connection.</span>
        </div>
      ) : null}
      {state === "degraded" ? (
        <div className="banner warning workspace-banner" role="status">
          <strong>Orders are partially available.</strong>
          <span>Some provider status may be delayed. Confirm uncertain payments or refunds in Needs attention.</span>
        </div>
      ) : null}
      {state === "error" ? (
        <div className="banner danger workspace-banner" role="alert">
          <strong>Orders could not be loaded.</strong>
          <span>{errorMessage ?? "The order source is unavailable. Existing sale state has not been changed."}</span>
          {onRetry ? (
            <button className="btn small" type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="card card-pad workspace-toolbar">
        <label className="field workspace-search" htmlFor="order-search">
          <span>Search orders</span>
          <input
            id="order-search"
            className="input"
            type="search"
            placeholder="Order, receipt, customer or transaction…"
            value={query}
            disabled={unavailable}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="field workspace-filter" htmlFor="order-status-filter">
          <span>Status</span>
          <select
            id="order-status-filter"
            className="select"
            value={status}
            disabled={unavailable}
            onChange={(event) => setStatus(event.target.value as "all" | OrderWorkspaceStatus)}
          >
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state === "loading" ? (
        <div className="card card-pad workspace-state" role="status" aria-live="polite">
          <div className="workspace-spinner" aria-hidden="true" />
          <div>
            <strong>Loading orders…</strong>
            <p>Existing transaction state is not being changed.</p>
          </div>
        </div>
      ) : null}

      {state !== "loading" && state !== "error" && filtered.length === 0 ? (
        <div className="card card-pad workspace-state" role="status">
          <div>
            <strong>{orders.length === 0 ? "No orders yet." : "No orders match this search."}</strong>
            <p>{orders.length === 0 ? "Completed sales will appear here when an order history source is mounted." : "Try another order, receipt, customer, transaction reference, or status."}</p>
          </div>
        </div>
      ) : null}

      {state !== "loading" && state !== "error" && filtered.length > 0 ? (
        <div className="workspace-table-wrap">
          <table className="workspace-table">
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Customer</th>
                <th scope="col">Date</th>
                <th scope="col">Payment</th>
                <th scope="col">Total</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td data-label="Order">
                    {onSelectOrder ? (
                      <button className="workspace-link" type="button" onClick={() => onSelectOrder(order.id)}>
                        {order.orderReference}
                      </button>
                    ) : (
                      <strong>{order.orderReference}</strong>
                    )}
                    {order.receiptNumber ? <span className="workspace-subline">{order.receiptNumber}</span> : null}
                  </td>
                  <td data-label="Customer">
                    {order.customerLabel}
                    {order.customerKind === "b2b" ? <span className="workspace-badge info">Wholesale</span> : null}
                  </td>
                  <td data-label="Date">{formatDateTime(order.createdAt)}</td>
                  <td data-label="Payment">
                    {order.paymentLabel}
                    {order.paymentStatus ? (
                      <span className={`workspace-badge ${badgeTone(order.paymentStatus)}`}>{order.paymentStatus.replaceAll("_", " ")}</span>
                    ) : null}
                  </td>
                  <td data-label="Total"><strong>{formatMoney(order.total)}</strong></td>
                  <td data-label="Status">
                    <span className={`workspace-badge ${badgeTone(order.status)}`}>{STATUS_LABELS[order.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export function OrderDetailDialog({ open, order, canReturn = true, onClose, onReprint, onStartReturn }: OrderDetailDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);

  if (!open || !order) return null;

  return (
    <div className="order-detail-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="order-detail-dialog card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <div className="order-detail-head">
          <div>
            <span className="eyebrow">Order detail</span>
            <h2 id="order-detail-title">{order.orderReference}</h2>
          </div>
          <button className="icon-btn" type="button" aria-label="Close order detail" onClick={onClose}>×</button>
        </div>
        <div className="order-detail-body">
          <div className="order-detail-grid">
            <div className="stack">
              <div><span className="eyebrow">Customer</span><strong>{order.customerLabel}</strong>{order.customerKind === "b2b" ? <span className="workspace-badge info">Wholesale</span> : null}</div>
              {order.transactionReference ? <div><span className="eyebrow">Transaction reference</span><strong>{order.transactionReference}</strong></div> : null}
              <div><span className="eyebrow">Payment</span><strong>{order.paymentLabel}</strong>{order.paymentStatus ? <span className={`workspace-badge ${badgeTone(order.paymentStatus)}`}>{order.paymentStatus.replaceAll("_", " ")}</span> : null}</div>
            </div>
            <div className="stack">
              <div><span className="eyebrow">Total</span><strong className="order-detail-total">{formatMoney(order.total)}</strong></div>
              <div><span className="eyebrow">Date</span><strong>{formatDateTime(order.createdAt)}</strong></div>
              {order.cashierLabel || order.registerLabel ? <div><span className="eyebrow">Cashier / register</span><strong>{[order.cashierLabel, order.registerLabel].filter(Boolean).join(" · ")}</strong></div> : null}
            </div>
          </div>
          <div className="order-detail-lines" aria-label="Order lines">
            {order.lines.map((line) => (
              <div className="order-detail-line" key={line.id}>
                <span>{line.quantity} × {line.name}{line.variationLabel ? <small>{line.variationLabel}</small> : null}</span>
                <strong>{formatMoney(line.total)}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="order-detail-actions">
          {onReprint ? <button className="btn" type="button" onClick={() => onReprint(order)}>Reprint</button> : null}
          {onStartReturn ? <button className="btn primary" type="button" disabled={!canReturn} onClick={() => onStartReturn(order)}>Return items</button> : null}
        </div>
      </section>
    </div>
  );
}
