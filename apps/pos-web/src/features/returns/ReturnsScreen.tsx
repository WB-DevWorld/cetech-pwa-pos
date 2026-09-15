"use client";

import { useState, type FormEvent } from "react";
import { ReturnFlow } from "./ReturnFlow";
import type { HistoricReturnSaleView, ReturnConditionView, ReturnSessionView } from "./returnView";

export type HistoricSaleLookup = {
  search(query: string): Promise<readonly HistoricReturnSaleView[]>;
};

export function ReturnsScreen({
  session,
  inFlight,
  lookup,
  onSelectSale,
  onUpdateLine,
  onPreview,
  onExecute,
  onResolve,
}: {
  session: ReturnSessionView;
  inFlight: boolean;
  lookup?: HistoricSaleLookup;
  onSelectSale: (sale: HistoricReturnSaleView) => void;
  onUpdateLine: (orderLineId: string, patch: { quantity?: string; reason?: string; condition?: ReturnConditionView }) => void;
  onPreview: () => void;
  onExecute: () => void;
  onResolve: () => void;
}) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<readonly HistoricReturnSaleView[]>([]);
  const [lookupError, setLookupError] = useState<string | undefined>();
  const [searching, setSearching] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lookup || searching) {
      return;
    }
    setSearching(true);
    setLookupError(undefined);
    try {
      const result = await lookup.search(query);
      setMatches(result);
      if (result.length === 0) {
        setLookupError("No historical sale matched that lookup.");
      }
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Sale lookup failed.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="returns-screen">
      <div className="page-head">
        <div>
          <h1>Returns</h1>
          <p>Historical refund amounts come from the return preview. Refund is not restock.</p>
        </div>
      </div>
      <section className="card card-pad">
        <form className="stack" onSubmit={handleSearch}>
          <div className="field">
            <label htmlFor="return-sale-query">Historical sale</label>
            <input
              id="return-sale-query"
              className="input"
              value={query}
              disabled={searching || inFlight || !lookup}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button className="btn primary" type="submit" disabled={searching || inFlight || !lookup}>
            {searching ? "Looking up…" : "Look up sale"}
          </button>
          {!lookup ? (
            <div className="banner warning" role="status">
              Historical sale lookup is not mounted. WS3 must inject a sale lookup seam.
            </div>
          ) : null}
        </form>
        {lookupError ? (
          <div className="banner danger" role="alert">
            {lookupError}
          </div>
        ) : null}
        {matches.map((sale) => (
          <button
            key={sale.saleId}
            type="button"
            className="btn"
            disabled={inFlight}
            onClick={() => onSelectSale(sale)}
          >
            {sale.orderReference}
          </button>
        ))}
      </section>
      {session.saleId ? (
        <ReturnFlow
          session={session}
          inFlight={inFlight}
          onUpdateLine={onUpdateLine}
          onPreview={onPreview}
          onExecute={onExecute}
          onResolve={onResolve}
        />
      ) : null}
    </div>
  );
}
