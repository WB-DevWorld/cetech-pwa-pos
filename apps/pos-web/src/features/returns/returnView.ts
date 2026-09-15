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
    message: "Look up a historical sale. Refund amounts come from the return preview, not today's catalog.",
    complete: false,
  };
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
  return disposition === "restock_sellable" ? "Restock as sellable" : "No automatic restock";
}

export function dispositionPolicyLabel(policy: DispositionPolicyView): string {
  if (policy === "automatic_sellable_restock") return "Automatic sellable restock";
  if (policy === "mandatory_no_automatic_restock") return "Mandatory: no automatic restock";
  return "Tenant policy required — follow the server disposition";
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
  if (effectIsBlocking(session.providerRefund)) labels.push("provider refund");
  if (effectIsBlocking(session.cashRefund)) labels.push("cash refund");
  if (effectIsBlocking(session.commercialRefund)) labels.push("commercial refund");
  if (effectIsBlocking(session.stockDisposition)) labels.push("stock disposition");
  return labels;
}

export function describeReturnStage(stage: ReturnStageView): { readonly title: string; readonly status: string } {
  switch (stage) {
    case "idle":
      return { title: "Returns", status: "Look up a historical sale to start a return." };
    case "selecting":
      return { title: "Select return lines", status: "Choose quantities, reasons, and conditions. Preview before refund." };
    case "previewing":
      return { title: "Previewing return", status: "Loading the server return preview. Refund totals are server-owned." };
    case "previewed":
      return { title: "Return preview", status: "Review the server refund total and stock disposition before executing." };
    case "approval_required":
      return { title: "Approval required", status: "This return needs a manager approval. Do not invent an approval." };
    case "executing":
      return { title: "Executing return", status: "Submitting the accepted return identity. Do not start another return." };
    case "resolving":
      return { title: "Checking return", status: "Return status is uncertain. Resolve the same return identity." };
    case "completed":
      return { title: "Return complete", status: "The server marked every required return effect complete." };
    case "in_progress":
      return { title: "Return in progress", status: "Independent return effects are still running." };
    case "refund_pending":
      return { title: "Refund pending", status: "A refund effect is still pending. Do not issue another refund." };
    case "requires_attention":
      return { title: "Return needs attention", status: "Escalate this return. Do not start a replacement return." };
    case "failed":
      return { title: "Return failed", status: "The return could not be previewed or executed. The sale is unchanged." };
  }
}
