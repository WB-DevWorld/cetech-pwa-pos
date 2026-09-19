/**
 * FE-06 return presentation. Refund totals and remaining quantities are
 * displayed from ReturnPreview only — never computed from catalog prices.
 */

export type ReturnConditionView =
  | "resellable"
  | "opened_resellable"
  | "damaged"
  | "defective"
  | "quarantine"
  | "not_physically_returned";

export type StockDispositionView = "restock_sellable" | "no_automatic_restock";

export type DispositionPolicyView =
  | "automatic_sellable_restock"
  | "mandatory_no_automatic_restock"
  | "tenant_policy_required";

export type ReturnStageView =
  | "idle"
  | "selecting"
  | "previewing"
  | "previewed"
  | "approval_required"
  | "executing"
  | "resolving"
  | "completed"
  | "in_progress"
  | "refund_pending"
  | "requires_attention"
  | "failed";

export type ReturnMoneyView = {
  readonly minor: number;
  readonly currency: string;
};

export type HistoricReturnLineView = {
  readonly orderLineId: string;
  readonly name: string;
  readonly originalSoldQuantity: string;
};

export type HistoricReturnSaleView = {
  readonly saleId: string;
  readonly orderReference: string;
  readonly currency: string;
  readonly lines: readonly HistoricReturnLineView[];
  readonly customerLabel?: string;
  readonly createdAt?: string;
  readonly total?: ReturnMoneyView;
  readonly itemSummary?: string;
};

export type ReturnLineDraftView = {
  readonly orderLineId: string;
  readonly name: string;
  readonly originalSoldQuantity: string;
  readonly quantity: string;
  readonly reason: string;
  readonly condition: ReturnConditionView;
};

export type ReturnPreviewLineView = {
  readonly orderLineId: string;
  readonly requestedQuantity: string;
  readonly remainingReturnableQuantity: string;
  readonly condition: ReturnConditionView;
  readonly intendedDisposition: StockDispositionView;
  readonly dispositionPolicy: DispositionPolicyView;
  readonly automaticSellableRestock: boolean;
};

export type IndependentEffectView = {
  readonly effectId?: string;
  readonly status: "not_started" | "not_required" | "not_found" | "pending" | "completed" | "requires_attention";
};

export type ReturnSessionView = {
  readonly stage: ReturnStageView;
  readonly saleId?: string;
  readonly returnId?: string;
  readonly fingerprint?: string;
  readonly expiresAt?: string;
  readonly refundTotal?: ReturnMoneyView;
  readonly approvalRequired: boolean;
  readonly approvalId?: string;
  readonly lines: readonly ReturnLineDraftView[];
  readonly previewLines: readonly ReturnPreviewLineView[];
  readonly providerRefund?: IndependentEffectView;
  readonly cashRefund?: IndependentEffectView;
  readonly commercialRefund?: IndependentEffectView;
  readonly stockDisposition?: IndependentEffectView;
  readonly refundIdentities: readonly string[];
  readonly message: string;
  readonly inputError?: string;
  readonly complete: boolean;
  readonly identityLocked: boolean;
};

export const NEVER_AUTOMATIC_SELLABLE: readonly ReturnConditionView[] = [
  "damaged",
  "quarantine",
  "not_physically_returned",
];

export function idleReturnSession(): ReturnSessionView {
  return {
    stage: "idle",
    approvalRequired: false,
    lines: [],
    previewLines: [],
    refundIdentities: [],
    message: "Find the original sale, choose the items being returned, and review the refund before completing.",
    complete: false,
    identityLocked: false,
  };
}

export const OUTSTANDING_RETURN_COPY =
  "This return must be resolved before starting another return.";

const LOCKED_RETURN_STAGES: ReadonlySet<ReturnStageView> = new Set([
  "executing",
  "resolving",
  "refund_pending",
  "in_progress",
  "requires_attention",
]);

/** An executed return whose effects may still exist stays bound to its returnId. */
export function returnIdentityLocked(session: Pick<ReturnSessionView, "stage" | "complete">): boolean {
  if (session.complete && session.stage === "completed") {
    return false;
  }
  return LOCKED_RETURN_STAGES.has(session.stage);
}

export function conditionLabel(condition: ReturnConditionView): string {
  if (condition === "resellable") return "Resellable";
  if (condition === "opened_resellable") return "Opened / resellable";
  if (condition === "damaged") return "Damaged";
  if (condition === "defective") return "Defective";
  if (condition === "quarantine") return "Quarantine";
  return "Not physically returned";
}

export function dispositionLabel(disposition: StockDispositionView): string {
  return disposition === "restock_sellable" ? "Return to sellable stock" : "Do not return to sellable stock";
}

export function dispositionPolicyLabel(policy: DispositionPolicyView): string {
  if (policy === "automatic_sellable_restock") return "Return to sellable stock";
  if (policy === "mandatory_no_automatic_restock") return "Do not return to sellable stock";
  return "Follow the required stock action";
}

export function presentsAutomaticSellableRestock(
  condition: ReturnConditionView,
  intendedDisposition: StockDispositionView,
  dispositionPolicy: DispositionPolicyView,
): boolean {
  if (NEVER_AUTOMATIC_SELLABLE.includes(condition)) {
    return false;
  }
  return intendedDisposition === "restock_sellable" && dispositionPolicy === "automatic_sellable_restock";
}

export function conditionRestockNotice(condition: ReturnConditionView): string | undefined {
  if (condition === "damaged") {
    return "Damaged goods are never automatically restocked as sellable. Refund is not restock.";
  }
  if (condition === "quarantine") {
    return "Quarantine items are never automatically restocked as sellable. Refund is not restock.";
  }
  if (condition === "not_physically_returned") {
    return "Items not physically returned are never automatically restocked as sellable. Refund is not restock.";
  }
  return undefined;
}

export function effectIsBlocking(effect: IndependentEffectView | undefined): boolean {
  if (!effect) {
    return false;
  }
  return (
    effect.status === "pending" ||
    effect.status === "not_found" ||
    effect.status === "requires_attention" ||
    effect.status === "not_started"
  );
}

export function canPresentReturnComplete(session: Pick<ReturnSessionView, "stage" | "complete">): boolean {
  return session.complete && session.stage === "completed";
}

export function unresolvedEffectLabels(session: ReturnSessionView): readonly string[] {
  const labels: string[] = [];
  if (effectIsBlocking(session.providerRefund)) labels.push("payment refund");
  if (effectIsBlocking(session.cashRefund)) labels.push("cash refund");
  if (effectIsBlocking(session.commercialRefund)) labels.push("order refund");
  if (effectIsBlocking(session.stockDisposition)) labels.push("stock update");
  return labels;
}

export function describeReturnStage(stage: ReturnStageView): { readonly title: string; readonly status: string } {
  switch (stage) {
    case "idle":
      return { title: "Returns", status: "Find the original sale to start a return." };
    case "selecting":
      return { title: "Select return items", status: "Choose quantities, reasons, and conditions. Review the refund before completing." };
    case "previewing":
      return { title: "Reviewing return", status: "Loading the refund review." };
    case "previewed":
      return { title: "Review return", status: "Review the refund and stock action before completing." };
    case "approval_required":
      return { title: "Approval required", status: "Manager approval is required before you can continue." };
    case "executing":
      return { title: "Completing return", status: OUTSTANDING_RETURN_COPY };
    case "resolving":
      return { title: "Checking return", status: `${OUTSTANDING_RETURN_COPY} Check the same return.` };
    case "completed":
      return { title: "Return complete", status: "Return completed successfully." };
    case "in_progress":
      return { title: "Return in progress", status: `${OUTSTANDING_RETURN_COPY} Some refund or stock updates are still pending.` };
    case "refund_pending":
      return { title: "Refund pending", status: `${OUTSTANDING_RETURN_COPY} A refund is still pending.` };
    case "requires_attention":
      return { title: "Return needs attention", status: `${OUTSTANDING_RETURN_COPY} Escalate this return. Do not start another return.` };
    case "failed":
      return { title: "Return failed", status: "The return could not be reviewed or completed. The sale is unchanged." };
  }
}
