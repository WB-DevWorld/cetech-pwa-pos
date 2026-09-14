# Current work ledger

Updated 2026-09-14. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains preserved under `docs/integration/evidence/**` and reviewed PR history. This file controls the current assignment and implementation authority.

## Current authority

- `main`: `da86434cc471703b8309cea77cda88b7845c299b` — PRE-R5 PR #51 merge; protected.
- PR #51 / PRE-R5 hardening: **APPROVED / MERGED / POST-MERGE VERIFIED**.
- PR #51 reviewed head: `49abf8509934fb319a479be59ce9e4192cb21178`.
- PR #51 post-merge CI: run `34830069895` — `control-plane` SUCCESS; `control-plane-windows` SUCCESS.
- PRE-R5 issues #46, #47, #48 and #49: **CLOSED / COMPLETED**.
- PRE-R5 integration lease: **RELEASED**.
- ADR-012 remains active. ADR-014 remains active and preserves human/workstream ownership across milestone handoffs.
- Explicit implementation reassignments: **NONE**.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.

## Active assignment — R5 idempotent prepare + cash

R5 was explicitly activated by the senior/user after PRE-R5 post-merge verification.

- Integration issue: **#52 R5-00** — neutral milestone integration/review surface.
- Draft milestone PR: **#53** — `[R5] Idempotent prepare and cash orchestration`.
- Neutral integration branch: `batch/r5-idempotent-prepare-cash`.
- Integration editor: `@wbdevworld` / WS3.
- Activation baseline: `main` `da86434cc471703b8309cea77cda88b7845c299b`.
- Activation evidence: `docs/integration/evidence/R5-ACTIVATION.md`.
- R5 activation/scheduler baseline head before this review-ledger update: `54a9a13e95758d9318260f90dc2ae81b93f7f840`; activation CI `34830892312` SUCCESS on both required jobs.
- Milestone state: **R5 ACTIVE**.

### Ordered human ownership queue

| Step | Task | Human / workstream | Contributor branch | Current status |
| --- | --- | --- | --- | --- |
| 1 | BR-06 / #18 — HPOS-safe idempotent prepare + resolve | `@Emmanuel-coder-prog` / WS2 | `ws2/br-06-implement-hpos-safe-idempotent-prepare-and-re` | **OWNER REMEDIATION REQUIRED** |
| 2 | BR-06 integration | `@wbdevworld` / WS3 integration | `batch/r5-idempotent-prepare-cash` | **BLOCKED — CURRENT SOURCE REVIEWED, NOT IMPORTED** |
| 3 | CORE-05 / #24 — cash + FinalizeSale orchestration | `@wbdevworld` / WS3 | create from exact tested `BR06_INTEGRATION_SHA` only | **BLOCKED / NOT STARTED** |
| 4 | Final R5 integration/review | `@wbdevworld` / WS3 integration | `batch/r5-idempotent-prepare-cash` | **BLOCKED ON STEPS 1–3** |

No intermediate merge to `main` is required between BR-06 and CORE-05.

## Current BR-06 integration review

Emmanuel published BR-06 from the declared WS2 branch. The current source chain is four commits ahead of the activation baseline:

- original implementation: `ec5dc534b3c3f5ab2373e1e1783c48ce55cae4cb`;
- original evidence: `230daad09af684dba92a481abce3ec8aad83cdc3`;
- crash-recovery remediation: `4417ed867adb6962025d62184385d394083d1737`;
- current source/evidence head: `d4b0d2fd7a94dcd18a3a2b89529befdbaa4fba74`.

Current source evidence reports canonical bridge tests `633 passed / 0 failed`, parity `138 passed / 0 failed / 19 permission-required-skipped`, schema drift PASS, exact-head CI run `34837386076` SUCCESS, and a new ADR-012 `FRESH_2`. Scope/provenance are clean. These facts do **not** override integration review findings.

WS3 independent integration review on `d4b0d2fd…` found two blockers, recorded on issue #18 comment `5663339003`:

1. **Crash-after-create acceptance remains incomplete.** Issue #18 requires “crash after order create recovers.” The current seam immediately after `wc_create_order` but before ordinary recovery metadata returns `REQUIRES_ATTENTION` on retry/resolve. This safely avoids a second Woo order but does not deterministically recover the original order. The owner must provide HPOS-safe identity/recovery across that exact window without guessing or creating order #2.
2. **Prepared Woo order commercial economics are not proven bound to the authoritative Quote.** The current production path adds products and recalculates the order rather than proving the created Woo order line/order totals equal the already-revalidated Quote snapshot. This is unsafe for WoodMart/B2BKing/ADR-013 pricing and conflicts with BR-07's later exact-order-total verification. The owner must preserve the accepted quote economics using supported Woo CRUD/order-item APIs and add regression coverage including a discount/B2B-style case.

Live effectful HPOS/database-concurrency rehearsal also remains honestly **PENDING** and must not be invented or executed without separate authority.

**Integration classification:** `BLOCKED_OWNER_REMEDIATION`. No BR-06 commit from the current source chain has been imported into PR #53.

## R5 handoff rule

1. Emmanuel / WS2 owns BR-06 issue #18 and all review remediation to its bridge implementation.
2. After a new tested remediation head is published, WS3 independently re-reviews it and imports only the declared accepted source commits into the neutral R5 branch.
3. WS3 runs combined verification and publishes the exact tested `BR06_INTEGRATION_SHA` only after the contribution is accepted.
4. Only then may `@wbdevworld` / WS3 create the CORE-05 contributor branch from that exact SHA and implement issue #24.
5. CORE-05 is imported back into the same neutral R5 branch, full combined checks run, then exactly two final ADR-012 freshness observations are performed and STOP.
6. A different competent human independently reviews the exact final R5 head before merge. No self-approval.

## R5 integration lease

**Editor:** WS3 / `@wbdevworld`.

**Allowed integration-editor work:**
- `CURRENT-WORK.md` and bounded integration evidence;
- draft PR #53 metadata and issue #52 coordination;
- exact declared contributor-commit imports into `batch/r5-idempotent-prepare-cash` after independent acceptance;
- independent contribution review, conflict resolution within authorized integration surfaces, combined tests and provenance;
- publication of `BR06_INTEGRATION_SHA` after tested BR-06 import;
- final R5 STATUS/HANDOFF/freshness/review coordination.

**Not authorized by the integration lease:**
- implementing or repairing BR-06 / WS2 bridge feature code;
- creating CORE-05 implementation before `BR06_INTEGRATION_SHA` exists;
- taking WS1 work;
- changing frozen v1 contract shapes/versions without separate authority;
- BR-07, FE-05 or any R6+ feature;
- split tender or full offline settlement;
- payment-provider execution, production promotion or destructive live actions;
- closing issue #4 or asserting `pricingParityVerified=true` without separate proof.

Review fixes return to the human owner of the affected contribution. An unavailable owner is not takeover permission. Any reassignment must be explicitly authorized by the senior and recorded here before implementation begins.

## R5 architectural invariants

- Quote is not reservation.
- PrepareSale must revalidate commercial/stock facts and claim idempotency.
- Woo order metadata lookup alone is not sufficient atomic deduplication or stock locking.
- Same intent retry/concurrency must not create multiple commercial orders.
- Recovery after an order-create crash must resolve the existing prepared sale rather than create another order.
- Prepared Woo commercial economics must remain bound to the accepted authoritative quote rather than be silently repriced outside the quoting context.
- CORE-05 FinalizeSale must consume verified evidence and repair partial POS persistence without creating a second sale.
- Receipt data and receipt-print side effect remain separate.
- Frozen v1.0.0 contracts remain authoritative unless a separate contract-change decision is recorded.

## Contributor provenance table

| Contribution | Declared owner | Actual implementer | Source branch/SHA | Imported SHA | Tested combined SHA | Receiver / next action |
| --- | --- | --- | --- | --- | --- | --- |
| BR-06 / #18 | `@Emmanuel-coder-prog` / WS2 | `@Emmanuel-coder-prog` / WS2 | branch `ws2/br-06-implement-hpos-safe-idempotent-prepare-and-re`; current head `d4b0d2fd7a94dcd18a3a2b89529befdbaa4fba74` | **NOT IMPORTED** | **NOT AVAILABLE** | Emmanuel remediates issue #18 review blockers, republishes tested source head |
| CORE-05 / #24 | `@wbdevworld` / WS3 | NOT STARTED | BLOCKED ON `BR06_INTEGRATION_SHA` | NOT STARTED | NOT STARTED | WS3 starts only after tested accepted BR-06 integration |

Missing provenance is **UNVERIFIED**, never inferred.

## Current next action

**Emmanuel / WS2 owns the only currently executable R5 feature work: remediate BR-06 / #18 according to the WS3 integration review on current head `d4b0d2fd…`.** WS3 does not take the fix and does not start CORE-05. When Emmanuel publishes a new tested remediation head, WS3 re-reviews it before any import.

PR #53 stays draft. Do not request final R5 review, merge R5, or start R6 work before the complete R5 gate is satisfied.
