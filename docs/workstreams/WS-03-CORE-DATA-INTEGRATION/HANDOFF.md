# WS3 current handoff — R8-01 Ben exact-head review remediation

Kind: TASK_COMPLETION. Date: 2026-09-17.

Task / batch / workstream: R8-01 / PR #69 / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Requested human reviewers: Ben (WS2/WS3 portions) and Emmanuel (WS1/WS3 portions). This agent does not approve, merge, or dismiss Ben's `CHANGES_REQUESTED`.
Mode: INTEGRATE / REMEDIATE.
PR: #69 draft. Do not convert to ready solely from this handoff. Do not request merge. Do not self-approve.

Branch: `batch/r8-safe-returns-reconciliation`
Starting reviewed/remediated head: `7fbc17ed4ad9754cc3fa39bf31bbe63a74868ff2`
Start `origin/main`: `1feb78db36f33e0254c0170396f30112d71577ea`

Contracts changed: none. Frozen v1 return-refund wire unchanged.
Database migrations: preserve `20260916220000_pos_return_line_allocations.sql` (incorrect `DEFAULT 1` / `CHECK > 0` remains in history). Append-only correction `20260917090000_pos_return_line_allocation_nonnegative.sql`.
Architecture decisions: none new. Canonical Money remains non-negative. `allocateHistoricMinor` remains refund math, including `0` for free/fully-discounted historic lines.

## Follow-up correction (not dismissed history)

`7fbc17e` persisted allocations but the first additive migration used strict-positive/`DEFAULT 1`. That invents untrue economics and rejects legitimate zero-value historic lines. The corrective migration backfills from immutable historic snapshots with integer `allocateHistoricMinor` semantics, drops synthetic defaults, accepts `>= 0`, sets remaining quantity `NOT NULL`, and re-enables `pos_return_requested_lines_immutable`.

## Tests executed (local)

See `docs/integration/evidence/R8-REVIEW-REMEDIATION.md`. Control-plane PASS; tooling 48 OK; lint/typecheck PASS; Vitest 69/654 PASS; build PASS; E2E 9 PASS; bridge 1555/0; parity 138/0/19 skip; pgTAP returns 43/43 (zero accepted, negative rejected), monotonic 6/6, electronic 16/16.

Remote effects performed: none (no Paystack, no Woo refund/restock, no production, no VitePOS change).

## Next exact action

Push this follow-up commit. Wait for exact-head `control-plane` and `control-plane-windows`. Then ADR-012 Pass 1 + Pass 2 only. Stop at `R8_REMEDIATION_READY_FOR_REVIEW`. Fresh independent review on the NEW exact head is required from Ben and Emmanuel.

Pass 3: NOT PERMITTED.
Production promotion: NOT AUTHORIZED.
Live electronic payment / live refund/restock: NOT AUTHORIZED.
Merge of PR #69: NOT AUTHORIZED.
