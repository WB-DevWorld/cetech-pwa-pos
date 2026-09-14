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
- Milestone state: **R5 ACTIVE**.

### Ordered human ownership queue

| Step | Task | Human / workstream | Contributor branch | Current status |
| --- | --- | --- | --- | --- |
| 1 | BR-06 / #18 — HPOS-safe idempotent prepare + resolve | `@Emmanuel-coder-prog` / WS2 | WS2 task branch; issue #18 controls exact scope | **AUTHORIZED / NOT STARTED** |
| 2 | BR-06 integration | `@wbdevworld` / WS3 integration | `batch/r5-idempotent-prepare-cash` | **WAITING FOR TESTED BR-06 SOURCE SHA(S)** |
| 3 | CORE-05 / #24 — cash + FinalizeSale orchestration | `@wbdevworld` / WS3 | create from exact tested `BR06_INTEGRATION_SHA` only | **BLOCKED / NOT STARTED** |
| 4 | Final R5 integration/review | `@wbdevworld` / WS3 integration | `batch/r5-idempotent-prepare-cash` | **BLOCKED ON STEPS 1–3** |

No intermediate merge to `main` is required between BR-06 and CORE-05.

## R5 handoff rule

1. Emmanuel / WS2 implements BR-06 inside issue #18 scope and publishes exact tested source SHA(s), files changed, exact test/runtime evidence, limitations and WS2 STATUS/HANDOFF.
2. WS3 independently reviews the BR-06 contribution and imports only the declared tested commit(s) into the neutral R5 branch.
3. WS3 runs combined verification and publishes the exact tested `BR06_INTEGRATION_SHA`.
4. Only then may `@wbdevworld` / WS3 create the CORE-05 contributor branch from that exact SHA and implement issue #24.
5. CORE-05 is imported back into the same neutral R5 branch, full combined checks run, then exactly two final ADR-012 freshness observations are performed and STOP.
6. A different competent human independently reviews the exact final R5 head before merge. No self-approval.

## R5 integration lease

**Editor:** WS3 / `@wbdevworld`.

**Allowed integration-editor work:**
- `CURRENT-WORK.md` and bounded integration evidence;
- draft PR #53 metadata and issue #52 coordination;
- exact declared contributor-commit imports into `batch/r5-idempotent-prepare-cash`;
- independent contribution review, conflict resolution within authorized integration surfaces, combined tests and provenance;
- publication of `BR06_INTEGRATION_SHA` after tested BR-06 import;
- final R5 STATUS/HANDOFF/freshness/review coordination.

**Not authorized by the integration lease:**
- implementing BR-06 / WS2 bridge feature code;
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
- CORE-05 FinalizeSale must consume verified evidence and repair partial POS persistence without creating a second sale.
- Receipt data and receipt-print side effect remain separate.
- Frozen v1.0.0 contracts remain authoritative unless a separate contract-change decision is recorded.

## Contributor provenance table

| Contribution | Declared owner | Actual implementer | Source branch/SHA | Imported SHA | Tested combined SHA | Receiver / next action |
| --- | --- | --- | --- | --- | --- | --- |
| BR-06 / #18 | `@Emmanuel-coder-prog` / WS2 | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | Emmanuel implements; WS3 waits |
| CORE-05 / #24 | `@wbdevworld` / WS3 | NOT STARTED | BLOCKED ON `BR06_INTEGRATION_SHA` | NOT STARTED | NOT STARTED | WS3 starts only after tested BR-06 integration |

Missing provenance is **UNVERIFIED**, never inferred.

## Current next action

**Emmanuel / WS2 owns the only currently executable feature task: BR-06 / #18.** WS3 does not implement it and does not start CORE-05 while waiting. When Emmanuel publishes his tested source SHA(s), WS3 reviews/imports them and publishes `BR06_INTEGRATION_SHA`.

PR #53 stays draft. Do not request final R5 review, merge R5, or start R6 work before the complete R5 gate is satisfied.
