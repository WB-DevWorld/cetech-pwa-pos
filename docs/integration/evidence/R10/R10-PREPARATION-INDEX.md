# R10 QA / release preparation index

Status: **PREPARATION ONLY — NOT R10 ACCEPTANCE**

Base protected `main`: `c320be8c5ad41c190200381cd52f853dd95212dc` — accepted STG-01 / PR #77.
Preparation branch: `ws3/r10-qa-release-preparation`.
Related tasks: QA-01 / #29 and REL-01 / #30.

## Purpose

Prepare the dependency-independent R10 qualification and release material after STG-01 acceptance while R9 / PR #63 continues separately. This branch does not implement application runtime, bridge, Supabase, R9 or STG-01 changes and does not claim that QA-01 or REL-01 has passed.

## Non-interference boundary

This preparation may add only bounded QA/release evidence and runbook material.

Do not edit from this branch:

- `apps/pos-web/src/**`
- `wordpress/**`
- `supabase/**`
- `CURRENT-WORK.md`
- `LIVE-ENVIRONMENT-FACTS.md`
- R9 implementation or superseded STG-01 branch content
- WS1 / WS2 implementation paths

No remote commerce write, payment, refund, stock mutation, production promotion or VitePOS change is authorized by this preparation.

## Current dependency truth

| Item | Current meaning for R10 preparation |
| --- | --- |
| R6 | Code merged. Historical training cash-sale evidence exists; STG-01 subsequently revalidated the production-intent staging composition/runtime and is now accepted. |
| R7 | Merged. Paystack TEST sandbox and reconciliation evidence may be reused as historical qualification evidence. |
| R8 | Merged. Return/refund/register safety implementation and automated evidence may be reused. |
| STG-01 / #70 / PR #77 | ACCEPTED. Issue #70 is closed; PR #77 is merged; canonical main is `c320be8c5ad41c190200381cd52f853dd95212dc`. Accepted evidence includes staff/session/CSRF, register/shift truth, Woo-derived catalog, customer context, authoritative quote path, exactly-one training cash sale → Woo order → receipt/reprint, operational workspaces and durable refresh/rebuild safety. Electronic live tender and `pricingParityVerified=false` remain outside this acceptance. |
| R9 / PR #63 | Draft. Most implementation exists; installed-device/update/recovery acceptance remains incomplete. |
| QA-01 / #29 | Open. This preparation defines the matrix and evidence format; it does not close the issue. |
| REL-01 / #30 | Open. Runbooks may be prepared now; actual rehearsal/pilot requires QA-01 and human authorization. |

## Reusable evidence already in main

- `docs/integration/evidence/R6-TRAINING-REAL-SALE.md`
- `docs/integration/evidence/CORE-06-ACCEPTANCE.md`
- `docs/integration/evidence/R7-PAY-01-SANDBOX.md`
- `docs/integration/evidence/R7-PAY-01-CONCURRENCY.md`
- `docs/integration/evidence/R8-FINAL-R7-RECONCILIATION.md`
- `docs/integration/evidence/R8-REVIEW-REMEDIATION.md`
- `docs/runbooks/R6-STAGING-CASH-SALE-REHEARSAL.md`
- `docs/runbooks/CP-04-REMAINING-WORK.md`

Historical PASS evidence is not silently promoted to current staging or production acceptance.

## Prepared R10 artifacts

1. `QA-01-QUALIFICATION-MATRIX.md` — failure, security and invariant qualification map.
2. `R10-AUTOMATED-QUALIFICATION-MAP.md` — maps R6–R8 executable tests to QA-01 matrix IDs and records remaining runtime-only gaps.
3. `R10-EVIDENCE-TEMPLATE.md` — common evidence record for later execution.
4. `docs/runbooks/R10-DEVICE-AND-PWA-REHEARSAL.md` — installed-device/update/recovery procedure.
5. `docs/runbooks/R10-BACKUP-RESTORE-ROLLBACK.md` — recovery and rollback procedure.
6. `R10-FAILURE-INJECTION-PLAN.md` — exact outage/lost-response/failure points and required recovery invariants.
7. `R10-GO-NO-GO.md` — explicit release blockers and final decision record.
8. `docs/runbooks/R10-VITEPOS-CUTOVER-PILOT.md` — cutover/pilot/first-day procedure.

## Status vocabulary

Use only these meanings in R10 preparation:

- **REUSE_EXISTING_EVIDENCE** — prior evidence exists and may inform qualification; current runtime acceptance may still be required.
- **PREPARED** — test/runbook/evidence procedure is defined but not executed.
- **PENDING_STG01** — historical status only; do not assign it to new rows because STG-01 is accepted on `c320be8c...`. Use **REUSE_EXISTING_EVIDENCE** for accepted STG-01 evidence and **PREPARED** where a distinct final-candidate/failure exercise still remains.
- **PENDING_R9** — blocked on accepted R9 installed-client/recovery behavior.
- **PENDING_AUTHORIZATION** — requires explicit human/runtime permission.
- **PASS / FAIL / BLOCKED** — allowed only after the exact procedure is actually executed against a recorded SHA/environment.

## Completion boundary for this preparation branch

This branch may be reviewed/merged only as preparation material. It must not:

- close QA-01 or REL-01;
- mark R10 complete;
- authorize production;
- authorize live electronic payment;
- authorize real refund/restock;
- authorize VitePOS cutover;
- substitute documentation for device/runtime evidence.
