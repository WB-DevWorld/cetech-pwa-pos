import { parseDecimalToMinorUnits } from "../../register/parseDecimalToMinorUnits";

export type CashInputView =
  | { readonly kind: "empty" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "under"; readonly receivedMinor: number; readonly message: string }
  | { readonly kind: "ready"; readonly receivedMinor: number; readonly changeDueMinor: number };

export function evaluateCashReceived(input: {
  readonly raw: string;
  readonly dueMinor: number;
  readonly currency: string;
}): CashInputView {
  const trimmed = input.raw.trim();
  if (!trimmed) {
    return { kind: "empty" };
  }
  const parsed = parseDecimalToMinorUnits(trimmed, { emptyMessage: "Enter the cash received." });
  if (!parsed.ok) {
    return { kind: "invalid", message: parsed.message };
  }
  if (!Number.isInteger(input.dueMinor) || input.dueMinor < 0 || !input.currency) {
    return { kind: "invalid", message: "Prepared total is not available." };
  }
  if (parsed.minor < input.dueMinor) {
    return {
      kind: "under",
      receivedMinor: parsed.minor,
      message: "Cash received is less than the amount due.",
    };
  }
  return {
    kind: "ready",
    receivedMinor: parsed.minor,
    changeDueMinor: parsed.minor - input.dueMinor,
  };
}

export function cashConfirmEnabled(view: CashInputView, options: { readonly busy: boolean; readonly prepared: boolean }): boolean {
  return options.prepared && !options.busy && view.kind === "ready";
}
