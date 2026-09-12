import { describe, expect, test } from "vitest";
import { commitQuantityDraft, holdQuantityDraft, restoreQuantityDraft } from "./quantityDraft";
import { parseQuantityInput } from "./quantity";
import { applyBarcodeScan, applyQuantityChange, createSellWorkspace, type SellWorkspaceDeps } from "./sellWorkspace";
import { SELL_TEST_CATALOG } from "./sellTestCatalog";

function deps(): SellWorkspaceDeps {
  let lines = 0;
  return {
    createCartId: () => "cart-qty",
    createLineId: () => `line-${++lines}`,
  };
}

describe("FE-03 quantity draft editing", () => {
  test("typing workflow can hold 1. as transient input without committing", () => {
    const draft = holdQuantityDraft("1.");
    expect(draft).toBe("1.");
    expect(parseQuantityInput("1.").ok).toBe(false);
    expect(commitQuantityDraft("1.", "1").kind).toBe("invalid");
  });

  test("committing 1.5 produces canonical 1.5", () => {
    expect(commitQuantityDraft("1.5", "1")).toEqual({ kind: "commit", quantity: "1.5" });
    expect(parseQuantityInput("1.5")).toEqual({ ok: true, quantity: "1.5" });
  });

  test("committing 3.50 produces 3.5", () => {
    expect(commitQuantityDraft("3.50", "1")).toEqual({ kind: "commit", quantity: "3.5" });
  });

  test("invalid commit does not mutate cart revision", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345", SELL_TEST_CATALOG, workspaceDeps);
    const before = state.cartRevision;
    const lineId = state.lines[0]!.lineId;
    const result = commitQuantityDraft("abc", state.lines[0]!.quantity);
    expect(result.kind).toBe("invalid");
    state = applyQuantityChange(state, lineId, "abc");
    expect(state.cartRevision).toBe(before);
    expect(state.lines[0]?.quantity).toBe("1");
  });

  test("valid decimal commit increments revision exactly once", () => {
    const workspaceDeps = deps();
    let state = createSellWorkspace(workspaceDeps, SELL_TEST_CATALOG);
    state = applyBarcodeScan(state, "0012345", SELL_TEST_CATALOG, workspaceDeps);
    const before = state.cartRevision;
    const committed = commitQuantityDraft("1.5", state.lines[0]!.quantity);
    expect(committed.kind).toBe("commit");
    if (committed.kind === "commit") {
      state = applyQuantityChange(state, state.lines[0]!.lineId, committed.quantity);
    }
    expect(state.lines[0]?.quantity).toBe("1.5");
    expect(state.cartRevision).toBe(before + 1);
  });

  test("rejects zero, negative, and scientific notation", () => {
    expect(parseQuantityInput("0").ok).toBe(false);
    expect(parseQuantityInput("-1").ok).toBe(false);
    expect(parseQuantityInput("1e3").ok).toBe(false);
    expect(restoreQuantityDraft("2")).toBe("2");
  });
});
