import { describeQuoteDisplay, type QuoteDisplayState } from "../state/quotePresentation";

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
      <div className="quote-status-message">
        {view.tone === "confirmed" ? <span aria-hidden="true">✓</span> : null}
        <span>{view.message}</span>
      </div>
      {view.comparison ? (
        <dl className="quote-changed">
          <div><dt>{view.comparison.previousLabel}</dt><dd>{view.comparison.previous}</dd></div>
          <div><dt>{view.comparison.currentLabel}</dt><dd>{view.comparison.current}</dd></div>
        </dl>
      ) : null}
    </div>
  );
}
