# R10 QA / release preparation index

Status: **PREPARATION ONLY — NOT R10 ACCEPTANCE**

Base protected `main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` — merged R8.
Preparation branch: `ws3/r10-qa-release-preparation`.
Related tasks: QA-01 / #29 and REL-01 / #30.

## Purpose

Prepare the dependency-independent R10 qualification and release material while STG-01 / PR #77 and R9 / PR #63 continue separately. This branch does not implement application runtime, bridge, Supabase, R9, STG-01 or UX-01 changes and does not claim that QA-01 or REL-01 has passed.

## Non-interference boundary

This preparation may add only bounded QA/release evidence and runbook material.

Do not edit from this branch:

- `apps/pos-web/src/**`
- `wordpress/**`
- `supabase/**`
- `CURRENT-WORK.md`
- `LIVE-ENVIRONMENT-FACTS.md`
- R9 or STG-01 branch content
- WS1 / WS2 implementation paths

No remote commerce write, payment, refund, stock mutation, production promotion or VitePOS change is authorized by this preparation.

## Current dependency truth

| Item | Current meaning for R10 preparation |
| --- | --- |
| R6 | Code merged. Historical training cash-sale evidence exists, but STG-01 later reopened production-intent staging composition/runtime acceptance. |
| R7 | Merged. Paystack TEST sandbox and reconciliation evidence may be reused as historical qualification evidence. |
| R8 | Merged. Return/refund/register safety implementation and automated evidence may be reused. |
| STG-01 / #70 / PR #77 | Active prerequisite. Functional staging acceptance remains incomplete. |
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
6. `docs/runbooks/R10-VITEPOS-CUTOVER-PILOT.md` — cutover/pilot/first-day procedure.

## Status vocabulary

Use only these meanings in R10 preparation:

- **REUSE_EXISTING_EVIDENCE** — prior evidence exists and may inform qualification; current runtime acceptance may still be required.
- **PREPARED** — test/runbook/evidence procedure is defined but not executed.
- **PENDING_STG01** — blocked on accepted production-intent staging runtime.
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
