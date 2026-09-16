# WS3 current handoff — R8-01 Ben exact-head review remediation

Kind: TASK_COMPLETION. Date: 2026-09-16.

Task / batch / workstream: R8-01 / PR #69 / WS3.
Owner / integration editor: `@wbdevworld` / WS3.
Requested human reviewers: Ben (WS2/WS3 portions) and Emmanuel (WS1/WS3 portions). This agent does not approve, merge, or dismiss Ben's `CHANGES_REQUESTED`.
Mode: INTEGRATE / REMEDIATE.
PR: #69 draft. Do not convert to ready solely from this handoff. Do not request merge. Do not self-approve.

Branch: `batch/r8-safe-returns-reconciliation`
START_FRESHNESS_SNAPSHOT UTC: 2026-09-16T22:12:00Z (fetch at remediation start)
Start `origin/main`: `1feb78db36f33e0254c0170396f30112d71577ea` (did not move during local remediation)
Prior exact R8 head Ben reviewed: `b6403c5d0df2d6d82d42eba41100b34aa3242cef`
Prior exact-head CI: `35143511686` SUCCESS then `CHANGES_REQUESTED`

Contracts changed: none. Frozen v1 return-refund wire unchanged.
Database migrations: additive `supabase/migrations/20260916220000_pos_return_line_allocations.sql`.
Architecture decisions: none new. `economicsVersion` is `PreparedSale.quoteFingerprint` as the shared binding token; historic `allocateHistoricMinor` remains refund math.

## Blockers fixed (not dismissed)

1. `economicsVersion` = prepared sale `quoteFingerprint` on preview, persistence, commercial refund, stock disposition, and fingerprint.
2. Exact preview line allocation persisted as `allocatedHistoricAmount` through store reload into bridge `historicAmount`.
3. Canonical return BFF routes + browser ReturnPort; PosApp mounts accepted FE-06 Returns and Register.

## Tests executed (local)

See `docs/integration/evidence/R8-REVIEW-REMEDIATION.md`. Control-plane PASS; tooling 48 OK; lint/typecheck PASS; Vitest 69/653 PASS; build PASS; E2E 9 PASS; bridge 1555/0; parity 138/0/19 skip; pgTAP returns 41/41, monotonic 6/6, electronic 16/16.

Remote effects performed: none (no Paystack, no Woo refund/restock, no production, no VitePOS change).

## Next exact action

Push the remediation commit. Wait for exact-head `control-plane` and `control-plane-windows`. Then ADR-012 Pass 1 + Pass 2 only. Stop at `R8_REMEDIATION_READY_FOR_REVIEW`. Fresh independent review on the NEW exact head is required from Ben and Emmanuel.

Pass 3: NOT PERMITTED.
Production promotion: NOT AUTHORIZED.
Live electronic payment / live refund/restock: NOT AUTHORIZED.
Merge of PR #69: NOT AUTHORIZED.
