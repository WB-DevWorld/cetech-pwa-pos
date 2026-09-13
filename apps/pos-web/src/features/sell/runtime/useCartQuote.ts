import { useEffect, useState } from "react";
import type { QuoteState } from "../../../../../../docs/contracts/domain.generated";
import type { PricingPort } from "../../../../../../docs/contracts/ports";
import type { CheckoutEligibilityView, QuoteDisplayState } from "../state/quotePresentation";
import type { SellWorkspaceState } from "../state/sellView";
import { checkoutEligibilityFromQuote } from "./checkoutEligibility";
import { quoteStateToDisplay } from "./mapQuoteDisplay";
import { buildQuoteRequest, expireQuoteIfNeeded, requestWholeCartQuote, quotingState } from "./quoteRequest";

export type UseCartQuoteInput = {
  readonly pricing?: PricingPort;
  readonly workspace: SellWorkspaceState | undefined;
  readonly locationId: string;
  readonly online: boolean;
  readonly shiftOpen: boolean;
  readonly now: () => Date;
};

export type UseCartQuoteResult = {
  readonly quote?: QuoteDisplayState;
  readonly eligibility?: CheckoutEligibilityView;
};

type RemoteQuote = {
  readonly revision: number;
  readonly state: QuoteState;
};

function localQuoteState(input: UseCartQuoteInput): QuoteState | undefined {
  const workspace = input.workspace;
  if (!workspace || workspace.lines.length === 0) {
    return { status: "missing" };
  }
  if (!input.online) {
    return { status: "offline" };
  }
  if (!input.pricing) {
    return {
      status: "failed",
      revision: workspace.cartRevision,
      code: "INTEGRATION_UNAVAILABLE",
      message: "Authoritative whole-cart quote is unavailable.",
    };
  }
  return undefined;
}

export function useCartQuote(input: UseCartQuoteInput): UseCartQuoteResult {
  const [remote, setRemote] = useState<RemoteQuote | null>(null);
  const local = localQuoteState(input);
  const revision = input.workspace?.cartRevision ?? 0;
  const nowIso = input.now().toISOString();
  const quote: QuoteState = local
    ?? (remote && remote.revision === revision
      ? expireQuoteIfNeeded(remote.state, nowIso)
      : quotingState(revision));

  useEffect(() => {
    const workspace = input.workspace;
    const pricing = input.pricing;
    if (!workspace || !pricing || !input.online || workspace.lines.length === 0) {
      return;
    }
    const request = buildQuoteRequest(workspace, input.locationId);
    if (!request) {
      return;
    }
    const requestRevision = request.cartRevision;
    let cancelled = false;
    void requestWholeCartQuote(pricing, request, { status: "missing" }).then((next) => {
      if (cancelled) return;
      setRemote((current) => {
        if (current && current.revision > requestRevision) {
          return current;
        }
        return { revision: requestRevision, state: next };
      });
    });
    return () => {
      cancelled = true;
    };
    // Quote only when commercial cart identity changes, not on search/browse state.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- workspace object also carries search/notice
  }, [input.locationId, input.online, input.pricing, input.workspace?.cartId, input.workspace?.cartRevision, input.workspace?.lines, input.workspace?.selectedCustomer]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const timer = window.setInterval(() => {
      setRemote((current) =>
        current ? { revision: current.revision, state: expireQuoteIfNeeded(current.state, new Date().toISOString()) } : current,
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const eligibility = checkoutEligibilityFromQuote({
    cartEmpty: (input.workspace?.lines.length ?? 0) === 0,
    shiftOpen: input.shiftOpen,
    online: input.online,
    quote,
  });

  return {
    quote: quoteStateToDisplay(quote),
    eligibility,
  };
}
