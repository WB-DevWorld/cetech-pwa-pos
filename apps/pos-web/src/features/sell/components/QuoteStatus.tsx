import { describeQuoteDisplay, type QuoteDisplayState } from "../state/quotePresentation";

export function QuoteStatus({ quote }: { quote: QuoteDisplayState }) {
  const view = describeQuoteDisplay(quote);
  return (
    <div className={`quote-status ${view.tone}`} data-quote-status={quote.status} data-quote-authority="supplied">
      <div>{view.message}</div>
      {view.code ? <div className="quote-status-code">{view.code}</div> : null}
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
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
