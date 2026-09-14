# Current work ledger

Updated 2026-09-14. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains preserved under `docs/integration/evidence/**` and reviewed PR/issue history. This file controls the current assignment and implementation authority.

## Current authority

- `main`: `da86434cc471703b8309cea77cda88b7845c299b` — PRE-R5 PR #51 merge; protected.
- PR #51 / PRE-R5 hardening: **APPROVED / MERGED / POST-MERGE VERIFIED**; post-merge CI `34830069895` SUCCESS on both required jobs.
- PRE-R5 issues #46–#49: **CLOSED / COMPLETED**; PRE-R5 lease **RELEASED**.
- ADR-012 active. ADR-014 active; human/workstream ownership is preserved across milestone handoffs.
- Explicit implementation reassignments: **NONE**.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.

## Active assignment — R5 idempotent prepare + cash

- Integration issue: **#52 R5-00**.
- Draft milestone PR: **#53** — `[R5] Idempotent prepare and cash orchestration`.
- Neutral integration branch: `batch/r5-idempotent-prepare-cash`.
- Integration editor: `@wbdevworld` / WS3.
- Activation baseline: `main` `da86434cc471703b8309cea77cda88b7845c299b`.
- Activation/scheduler head: `54a9a13e95758d9318260f90dc2ae81b93f7f840`; activation CI `34830892312` SUCCESS both required jobs.
- Prior integration-control head before this review-ledger update: `c7a0431f469e540a76ed68e4584b02f3e5af90ee`; CI `34839482887` SUCCESS.
- Milestone state: **R5 ACTIVE**.

### Ordered ownership queue

| Step | Task | Human / workstream | Contributor branch | Current status |
| --- | --- | --- | --- | --- |
| 1 | BR-06 / #18 — HPOS-safe idempotent prepare + resolve | `@Emmanuel-coder-prog` / WS2 | `ws2/br-06-implement-hpos-safe-idempotent-prepare-and-re` | **OWNER REMEDIATION REQUIRED** |
| 2 | BR-06 integration | `@wbdevworld` / WS3 integration | `batch/r5-idempotent-prepare-cash` | **BLOCKED — SOURCE REVIEWED, NOTHING IMPORTED** |
| 3 | CORE-05 / #24 — cash + FinalizeSale orchestration | `@wbdevworld` / WS3 | create from exact tested `BR06_INTEGRATION_SHA` only | **BLOCKED / NOT STARTED** |
| 4 | Final R5 integration/review | `@wbdevworld` / WS3 integration | `batch/r5-idempotent-prepare-cash` | **BLOCKED ON STEPS 1–3** |

No intermediate merge to `main` is required between BR-06 and CORE-05.

## Current BR-06 source and review

Declared owner/actual implementer: `@Emmanuel-coder-prog` / WS2.

Current exact source head: `312dcc3cebd644d5b6ea206210be437e3f001869`.

Published source chain from `main`:
1. `ec5dc534b3c3f5ab2373e1e1783c48ce55cae4cb` — original BR-06 implementation;
2. `230daad09af684dba92a481abce3ec8aad83cdc3` — original evidence;
3. `4417ed867adb6962025d62184385d394083d1737` — crash-window remediation;
4. `d4b0d2fd7a94dcd18a3a2b89529befdbaa4fba74` — crash evidence;
5. `7f3ca2df3fd0548fed7734c7b87d46ef9d68a168` — complete/unexpired reservation proof;
6. `63b6d068a1400c9bea14c03c8728c59b08103deb` — reservation evidence;
7. `a48cca6f670eec805222442437613da4b428d76e` — recovery-token + authoritative Quote-economics remediation;
8. `312dcc3cebd644d5b6ea206210be437e3f001869` — current evidence/head.

Current owner evidence reports:
- canonical bridge tests **820 passed / 0 failed**;
- parity **138 passed / 0 failed / 19 permission-required-skipped**;
- control-plane/schema drift/diff checks PASS;
- exact-head CI `34843762668` SUCCESS on both required jobs;
- owner final freshness `FRESH_2 / RECONCILED_2` against unchanged main and then-current batch;
- live HPOS/database-concurrency rehearsal **PENDING**, correctly not claimed.

### Prior blockers now materially closed

WS3 re-review confirms the current code materially addresses the two blockers from issue #18 comment `5663339003`:

1. A high-entropy bridge-owned recovery token is stored before Woo create and bound into the **initial** Woo order save via supported Woo order-key/meta APIs, enabling token-based recovery before ordinary transaction/hash metadata exists.
2. Accepted authoritative Quote line/order economics are written with supported Woo CRUD and then verified against the saved order; `calculate_totals(false)` is not used to silently reprice the prepared order.

These improvements are retained and should not regress.

### Current blocking findings — issue #18 comment `5664357878`

BR-06 is still **NOT READY FOR IMPORT** because the new recovery path introduces two correctness gaps:

1. **GET resolve performs write-repair without the creator lock.** `resolve()` calls `try_recover_order(..., false)`, which calls `finish_recovered_order(..., false)`. That function currently applies/saves Quote economics and ordinary recovery metadata before checking `may_complete_reservation=false`. Therefore the GET resolution route can write Woo order items/totals/meta outside the prepare creator lock and can race with POST retry or trigger Woo save hooks. Resolve must be observational/read-only for incomplete recovery; POST retry under the creator lock owns repair/reservation.
2. **Crash coverage misses initial-save / partial-snapshot persistence.** The production `after_wc_create` seam fires only after `apply_quote_snapshot_to_order()`. WooCommerce `add_product()` persists each order item immediately, so a process death while writing a multi-line Quote can leave a token-owned partial order. Current snapshot application adds lines only when there are zero existing items; a partial order is therefore not deterministically repaired. Add a true post-initial-save/pre-snapshot seam and a mid-snapshot seam, and make token-owned not-yet-reserved snapshot repair idempotent/fail-closed on ambiguity.

The canonical current BR-06 evidence also contains appended older crash tables that contradict the new seam-A result. Final task evidence must be made unambiguous while preserving history separately if needed.

**Integration classification:** `BLOCKED_OWNER_REMEDIATION`.

No BR-06 source commit has been imported into PR #53. `BR06_INTEGRATION_SHA` **DOES NOT EXIST**.

## R5 handoff rule

1. Emmanuel / WS2 owns all BR-06 implementation and review remediation.
2. After a replacement tested source head is published, WS3 independently re-reviews it and imports only accepted declared commits.
3. WS3 runs combined verification and publishes exact tested `BR06_INTEGRATION_SHA` only after BR-06 acceptance.
4. Only then may `@wbdevworld` / WS3 create the CORE-05 contributor branch from that exact SHA and implement #24.
5. CORE-05 is imported back into the neutral R5 branch; full combined checks run; exactly two final ADR-012 freshness observations are performed and STOP.
6. A different competent human independently reviews the exact final R5 head before merge. No self-approval.

## R5 integration lease

**Editor:** WS3 / `@wbdevworld`.

Allowed integration-editor work: scheduler/evidence/PR coordination; independent contribution review; exact accepted commit imports; integration conflict resolution within authorized surfaces; combined tests/provenance; publication of `BR06_INTEGRATION_SHA`; final R5 handoff/freshness/review coordination.

Not authorized: implementing or repairing WS2 BR-06; creating CORE-05 before `BR06_INTEGRATION_SHA`; taking WS1 work; changing frozen v1 contracts without separate authority; BR-07/R6+; split tender/full offline settlement; payment-provider execution; production promotion/destructive live action; closing issue #4 or asserting `pricingParityVerified=true` without proof.

Review fixes return to the human owner. Owner unavailability is not takeover permission. Any reassignment must be explicitly recorded here before implementation.

## R5 invariants

- Quote is not reservation.
- PrepareSale revalidates commercial/stock facts and claims idempotency.
- Woo order metadata lookup alone is not the atomic claim/stock lock.
- Same intent retry/concurrency must not create multiple Woo orders.
- Crash recovery must deterministically map/repair the original token-owned order or fail closed without order #2.
- Resolution/status lookup must not become an unlocked hidden write path.
- Prepared Woo economics remain bound to the accepted authoritative Quote.
- CORE-05 FinalizeSale consumes verified evidence and repairs partial POS persistence without creating a second sale.
- Frozen v1.0.0 contracts remain authoritative absent a separate decision.

## Contributor provenance

| Contribution | Declared owner | Actual implementer | Source branch/SHA | Imported SHA | Tested combined SHA | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| BR-06 / #18 | `@Emmanuel-coder-prog` / WS2 | `@Emmanuel-coder-prog` / WS2 | branch `ws2/br-06-implement-hpos-safe-idempotent-prepare-and-re`; reviewed head `312dcc3cebd644d5b6ea206210be437e3f001869` | **NOT IMPORTED** | **NOT AVAILABLE** | Emmanuel remediates comment `5664357878`, republishes tested source head |
| CORE-05 / #24 | `@wbdevworld` / WS3 | NOT STARTED | BLOCKED ON `BR06_INTEGRATION_SHA` | NOT STARTED | NOT STARTED | start only after tested accepted BR-06 integration |

Missing provenance is **UNVERIFIED**, never inferred.

## Current next action

**Emmanuel / WS2 owns the only executable R5 feature work: remediate BR-06 / #18 review comment `5664357878`.** WS3 does not implement the fixes and does not start CORE-05. PR #53 stays draft. Do not request final R5 review, merge R5, or start R6.