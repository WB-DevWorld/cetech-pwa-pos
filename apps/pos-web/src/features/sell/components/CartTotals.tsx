import type { QuoteAmountRow } from "../state/quotePresentation";

export function CartTotals({ rows }: { rows: readonly QuoteAmountRow[] }) {
  if (rows.length === 0) return null;
  return (
    <dl className="cart-totals">
      {rows.map((row) => (
        <div key={row.label} className={row.emphasize ? "summary-row total" : "summary-row"}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
