import { describeQuoteDisplay, type QuoteDisplayState } from "../state/quotePresentation";
import { TechnicalDetails } from "../../../ui/cashier-language";

export function QuoteStatus({
  quote,
  cartLineNames,
}: {
  quote: QuoteDisplayState;
  cartLineNames?: readonly string[];
}) {
  const view = describeQuoteDisplay(quote, { cartLineNames });
  return (
    <div className={`quote-status ${view.tone}`} data-quote-status={quote.status} data-quote-authority="supplied" role="status" aria-live="polite">
      <div>{view.message}</div>
      {view.comparison ? (
        <dl className="quote-changed">
          <div>
            <dt>{view.comparison.previousLabel}</dt>
            <dd>{view.comparison.previous}</dd>
          </div>
          <div>
            <dt>{view.comparison.currentLabel}</dt>
            <dd>{view.comparison.current}</dd>
          </div>
        </dl>
      ) : null}
      {view.amounts ? (
        <dl className="quote-amounts">
          {view.amounts.map((row) => (
            <div key={row.label} className={row.emphasize ? "quote-amount-total" : undefined}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {view.code || view.technicalMessage ? (
        <TechnicalDetails
          rows={[
            ...(view.code ? [{ label: "Error code", value: view.code }] : []),
            ...(view.technicalMessage ? [{ label: "Technical message", value: view.technicalMessage }] : []),
          ]}
        />
      ) : null}
    </div>
  );
}
