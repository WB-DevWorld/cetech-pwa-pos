import type { Quote, QuoteState } from "../../../../../../docs/contracts/domain.generated";
import {
  INTEGRATION_UNAVAILABLE,
  isFailedQuoteCode,
  type QuoteDisplayState,
  type QuotePresentationLine,
  type QuotePresentationSnapshot,
} from "../state/quotePresentation";

export function quoteToPresentationSnapshot(quote: Quote): QuotePresentationSnapshot {
  return {
    total: quote.total,
    subtotal: quote.subtotal,
    discount: quote.discount,
    tax: quote.tax,
    lines: quote.lines.map(
      (line): QuotePresentationLine => ({
        lineId: line.lineId,
        unitPrice: line.unitPrice,
        total: line.total,
      }),
    ),
  };
}

export function quoteStateToDisplay(state: QuoteState): QuoteDisplayState {
  switch (state.status) {
    case "missing":
    case "stale":
    case "expired":
    case "offline":
      return { status: state.status };
    case "quoting":
      return { status: "quoting", revision: state.revision };
    case "confirmed":
      return { status: "confirmed", revision: state.revision, quote: quoteToPresentationSnapshot(state.quote) };
    case "changed":
      return {
        status: "changed",
        revision: state.revision,
        previous: quoteToPresentationSnapshot(state.previous),
        current: quoteToPresentationSnapshot(state.current),
      };
    case "failed":
      return {
        status: "failed",
        revision: state.revision,
        code: isFailedQuoteCode(state.code) ? state.code : INTEGRATION_UNAVAILABLE,
        message: state.message,
      };
  }
}
