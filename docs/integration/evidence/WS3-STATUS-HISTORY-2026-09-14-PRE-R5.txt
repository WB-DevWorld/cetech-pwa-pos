# WS3 current status

Snapshot 2026-09-13. CORE-04 INTEGRATED_AND_TESTED on PR #41. Cross-cart quote isolation continuation after Emmanuel `CHANGES_REQUESTED` on `9703b27…` (prior three remediations accepted). Pre-handoff SHA `e92659a…`. Freshness **FRESH_2**. Issue #23 OPEN until reviewed merge. R4 **AWAITING INDEPENDENT RE-REVIEW** / not merged. `pricingParityVerified` false. Issue #4 OPEN. Do not start R5. Evidence: `docs/integration/evidence/R4-CROSS-CART-QUOTE.md`, `docs/integration/evidence/R4-CROSS-CART-QUOTE-FRESHNESS.md`. CURRENT-WORK holds the central R4 lease on PR #41.

## Previous snapshot (independent-review remediation — historical; current section above controls)

# WS3 current status

Snapshot 2026-09-13. CORE-04 INTEGRATED_AND_TESTED on PR #41. Independent-review remediation of Emmanuel `CHANGES_REQUESTED` on `31bbfcc…`: catalog cursor last-returned semantics plus journal idempotency already on the branch. Issue #23 OPEN until reviewed merge. R4 **AWAITING INDEPENDENT RE-REVIEW** / not merged. `pricingParityVerified` false. Issue #4 OPEN. Do not start R5. Evidence: `docs/integration/evidence/R4-REVIEW-REMEDIATION.md`. CURRENT-WORK holds the central R4 lease on PR #41.

## Previous snapshot (journal idempotency — historical; current section above controls)

# WS3 current status

Snapshot 2026-09-13. CORE-04 INTEGRATED_AND_TESTED on PR #41 with journal idempotency remediation SHA `11bdbd9c6bb5004e9dd70a203a53becdf191728e`: same key + different `requestHash` is `IDEMPOTENCY_CONFLICT` including after `acknowledged`. Isolated SHA `73b3fd9fbe6028dc1cd5eec9b21945c987882886` plus active-cart/cashier seed `0b9414102a048a03ba25f4f331238477c7b8d4fc`. Issue #23 OPEN until reviewed merge. R4 assembled / not merged. `pricingParityVerified` false. Issue #4 OPEN. Do not start R5. Evidence: `docs/integration/evidence/R4-JOURNAL-IDEMPOTENCY.md`. CURRENT-WORK holds the central R4 lease on PR #41.

## Previous snapshot (R4 ACTIVATION — historical; current section above controls)

# WS3 current status

Snapshot 2026-09-13. Main `516d6a49af74cc6677f67bdf843de6e819a05feb`. R3 PR #44 APPROVED / MERGED / POST-MERGE VERIFIED (CI run 34778771391). ADR-013 accepted through that reviewed merge. Training plugin/evidence remains training-specific. `pricingParityVerified` false. Issue #4 OPEN. CP-04 not globally complete. R3 lease RELEASED. R4 ACTIVATED on existing PR #41. Queue CORE-04 → FE-03 → FE-04. Do not start R5. Evidence: `docs/integration/evidence/R4-START-FRESHNESS.md`.

CURRENT-WORK holds the central R4 lease.

## Previous snapshot (R3 CART-DISCOUNT — historical; current section above controls)

# WS3 current status

Snapshot 2026-09-13. Main `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. R3 PR #44. ADR-013 records provider-neutral cart-level commercial discounts in existing Quote v1 fields (no fee field). Training plugin `0.2.7-br02`. `pricingParityVerified` false. Issue #4 OPEN. Do not start R4. Evidence: `docs/integration/evidence/R3-CART-DISCOUNT.md`.

CURRENT-WORK holds the central R3 lease.

## Previous snapshot (R3 UNITPRICE — historical; current section above controls)

# WS3 current status

Snapshot 2026-09-13. Main `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. R3 draft #44. Bounded BR-02 `unitPrice` remediation on `batch/r3-authoritative-pricing-parity` before any training plugin update. Live parity PERMISSION_REQUIRED. Pricing gate NOT PASSED. Issue #4 OPEN. Do not start R4. Evidence: `docs/integration/evidence/R3-UNITPRICE-START-FRESHNESS.md`.

CURRENT-WORK holds the central R3 lease.

## Previous snapshot (R3 FRESH_2 / GATE BLOCKED — historical; current section above controls)

# WS3 current status

Snapshot 2026-09-13. Main `ab9aa5ae3dcc79d51efb22c19bd1f17f38d57f77`. R1/#40 APPROVED / MERGED / VERIFIED. R2/#43 APPROVED / MERGED / VERIFIED (post-merge CI run 34765462210 success). ADR-012 ACTIVE. R2 integration lease RELEASED. R3 on `batch/r3-authoritative-pricing-parity`: local quote implemented; live parity PERMISSION_REQUIRED; pricing gate NOT PASSED; freshness FRESH_2. Issue #4 OPEN. Overall CP-04 not complete. Do not start R4. Evidence: `docs/integration/evidence/R3-FRESHNESS.md`.

CURRENT-WORK holds the central R3 lease.

## Previous snapshot (R2 BR-01 Make verification — historical; current section above controls)

# WS3 current status

Snapshot 2026-09-13. Main `aa08d74f2cb99301817e5995f01486acb7e2169f`. R1/#40 APPROVED / MERGED / VERIFIED. ADR-012 ACTIVE. R2 [#43](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/43) ready-for-review. Ben `CHANGES_REQUESTED` on `0deafa301411bc226e453446455a1f85d92607d7` for exact-head BR-01 Make verification. This continuation executed `make check` EXIT 0 and `make test` EXIT 0 on that SHA: **83 passed, 0 failed** (PHP 8.5.0 / GNU Make 4.4.1). Production PHP unchanged; no bridge code fix required. Historical import checkpoint remains `BLOCKED_VERIFICATION` (php/make absent then); current classification is **VERIFIED**. CORE-02 **COMPLETE FOR R2** (issue #21). BR-01 `280a73d…` remains the production-plugin import (`0ac2e38…`); normalization tests imported as `605e6f2…`. CORE-03 live hops unchanged. Pricing parity **FALSE / NOT TESTED**. Issue #4 OPEN. Do not start R3. Evidence: `docs/integration/evidence/R2-BR-01-MAKE-VERIFY.md`.

CURRENT-WORK holds the central R2 lease.

## Previous snapshot (historical; current section above controls)

# WS3 current status

Snapshot 2026-09-13. Main `aa08d74f2cb99301817e5995f01486acb7e2169f`. R1/#40 APPROVED / MERGED / VERIFIED. ADR-012 ACTIVE. R2 draft [#43](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/43). New continuation imported BR-01 test SHA `130437d6…` as `605e6f2…` (`cherry-pick -x`; production PHP unchanged). Prior runtime classification of that SHA as IRRELEVANT is superseded: COMPATIBLE/RELEVANT to R2 negative-auth evidence. `make check`/`test` on this import are **BLOCKED** on the current workstation. CORE-02 **COMPLETE FOR R2** (issue #21). BR-01 `280a73d…` remains the production-plugin import (`0ac2e38…`). CORE-03 live hops unchanged by this test import. Pricing parity **FALSE / NOT TESTED**. Issue #4 OPEN. Do not start R3. Evidence: `docs/integration/evidence/R2-BR-01-NORMALIZATION-IMPORT.md`.

CURRENT-WORK holds the central R2 lease.

## Previous snapshot (historical; current section above controls)

# WS3 current status

Snapshot 2026-09-12. Main `aa08d74f2cb99301817e5995f01486acb7e2169f`. R1/#40 APPROVED / MERGED / VERIFIED. ADR-012 ACTIVE. R2 draft [#43](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/43). CORE-02 CHECKPOINTED `2f6c0b50cd7889e83df93b87af0b7c165152b5db` (issue #21). CORE-03 ADAPTER CHECKPOINTED; Next `/health` unattached; not COMPLETE (issue #22). BR-01 `fbbf0ea7…` PROVISIONAL_TEST / unaccepted (`STALE_REQUIRES_OWNER_REFRESH`). Continuation START_FRESHNESS_SNAPSHOT `2026-09-12T22:22:20Z`. Do not recreate R1 or CORE-01. Do not start R3.

CURRENT-WORK holds the central R2 lease.

## Previous snapshot (historical; current section above controls)

# WS3 status

Updated: 2026-09-12 CORE-01. Owner: Senior / @wbdevworld.

Control-plane/contracts implemented and verified. CP-05 is MERGED / VERIFIED on `main` via PR #32. CI-01 is MERGED / VERIFIED on `main` via PR #38 (`8e058d6…`; @Ben-001-sys APPROVED; lease RELEASED). FE-01 PR #33 / issue #6 and FE-02 PR #37 / issue #7 are MERGED / COMPLETED (WS1-owned STATUS files are not edited here). CP-04 development baseline is SATISFIED (ADR-011); write-safety/cutover evidence remains OPEN / DEFERRED. Issue #4 stays open.

| Task | State | Branch / evidence |
| --- | --- | --- |
| CP-01 | IMPLEMENTED / VERIFIED; available for human review | Foundation 9229334; CI 34643828253 success; issue remains review/coordination surface |
| CP-02 | IMPLEMENTED / VERIFIED; available for human review | Foundation 9229334; CI 34643828253 success; issue remains review/coordination surface |
| CP-03 | IMPLEMENTED / VERIFIED; available for human review | Foundation 9229334; CI 34643828253 success; issue remains review/coordination surface |
| CP-04 | DEVELOPMENT BASELINE SATISFIED; W1 PASS on training; W4 PASS on training WordPress side; write-safety/cutover otherwise OPEN | ADR-011; CP-04 branch `edf24af…`; W4 evidence `67ea42c…`. Issue #4 OPEN. Overall CP-04 not complete. Isolation NOT PROVEN for remaining write tests. Mail containment must stay preserved. No new write tests. |
| CP-05 | MERGED / VERIFIED | PR #32; merge `095696f15cd64b546003bc5c77b4600af7bc4c76`; @Ben-001-sys APPROVED; issue #5 CLOSED / COMPLETED |
| CI-01 | MERGED / VERIFIED; lease RELEASED | PR #38; merge `8e058d679bb02e96374c0e79cc32d025b6a9ed03`; @Ben-001-sys APPROVED |
| CORE-01 | ACCEPTED / MERGED / VERIFIED; lease RELEASED | PR #40 merge `aa08d74f…`; @Ben-001-sys APPROVED `260be7f…`. Do not recreate. |
| CORE-02 | COMPLETE FOR R2; durable runtime store VERIFIED | R2 `batch/r2-auth-bridge-bff`; issue #21. Ephemeral store still refused for production/staging. Live proof: `docs/integration/evidence/R2-RUNTIME-ACCEPTANCE.md` |
| CORE-03 | LIVE RUNTIME ACCEPTED | Same R2 branch; issue #22. BR-01 imported `0ac2e38…`. Training WordPress health verified (`67ea42c…`). Durable session VERIFIED; Browser/BFF→Supabase VERIFIED; BFF→bridge→Woo VERIFIED. Detection is not pricing parity. |
| CORE-04 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |
| CORE-05 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |
| CORE-06 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |
| PAY-01 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |
| RT-01 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |
| CORE-07 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |
| QA-01 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |
| REL-01 | SPECIFIED | See TASKS.md; GitHub mapping in ../../plans/TASK-INDEX.md |

CORE-01 lease RELEASED after PR #40 merge. R2 holds the current central lease (`apps/pos-web/src/core/**`, `src/server/**`, `src/config/**`, `src/app/api/**`, `tests/integration/auth/**`, `tests/integration/health/**`, plus recorded coordination files). Issue #4 stays OPEN. ADR-012 is ACTIVE. Update with actual evidence; never mark a prerequisite fulfilled from a task specification.
