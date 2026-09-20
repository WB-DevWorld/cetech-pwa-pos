# R10 QA / release preparation index

Status: **PREPARATION ONLY — NOT R10 ACCEPTANCE**

Base protected `main`: `7c5d6ca0cd93d7aeb5a7a1c97153ca187548c3fb` — accepted REC-01 / PR #80 on top of accepted STG-01 / PR #77 and accepted exact-SHA Preview infrastructure / PR #81.
Preparation branch: `ws3/r10-qa-release-preparation` / PR #79.
Related tasks: QA-01 / #29 and REL-01 / #30.

## Purpose

Prepare the dependency-independent R10 qualification and release material after STG-01 and REC-01 acceptance while R9 / PR #63 continues separately. This branch does not implement application runtime, bridge, Supabase, R9 or REC-01 source changes and does not claim that QA-01 or REL-01 has passed.

## Non-interference boundary

This preparation may add only bounded QA/release evidence and runbook material. The current reconciliation assignment additionally allows `CURRENT-WORK.md` and WS3 STATUS/HANDOFF only for exact reconciliation evidence.

Do not edit from this branch:

- `apps/pos-web/src/**`
- `wordpress/**`
- `supabase/**`
- `LIVE-ENVIRONMENT-FACTS.md`
- R9 implementation or superseded STG-01/REC-01 source
- issues #82–#88 implementation
- WS1 / WS2 implementation paths

No remote commerce write, payment, refund, stock mutation, production promotion or VitePOS change is authorized by this preparation.

## Current dependency truth

| Item | Current meaning for R10 preparation |
| --- | --- |
| R6 | Code merged. Historical training cash-sale evidence exists; STG-01 subsequently revalidated the production-intent staging composition/runtime and is now accepted. |
| R7 | Merged. Paystack TEST sandbox and reconciliation evidence may be reused as historical qualification evidence. |
| R8 | Merged. Return/refund/register safety implementation and automated evidence may be reused. |
| STG-01 / #70 / PR #77 | ACCEPTED. Issue #70 is closed; PR #77 is merged as `c320be8c5ad41c190200381cd52f853dd95212dc`. Accepted evidence includes staff/session/CSRF, register/shift truth, Woo-derived catalog, customer context, authoritative quote path, exactly-one training cash sale → Woo order → receipt/reprint, operational workspaces and durable refresh/rebuild safety. Electronic live tender and `pricingParityVerified=false` remain outside this acceptance. |
| CD-01 / #64 / PR #81 | ACCEPTED. Exact-SHA immutable Preview infrastructure is on protected main as `c1f659ea118a885180fe6a543797efa908abf210`. Dispatch remains a later authorized action and is not production promotion. |
| REC-01 / PR #80 | ACCEPTED. Source `6995e1c2324432e4cba234f6844bcb224e3d7a57`; resulting main `7c5d6ca0cd93d7aeb5a7a1c97153ca187548c3fb`. Accepted only for the behavior actually exercised: exact immutable Preview; running BUILD_ID verified; controlled staging cash sale order `49606` / receipt `POS-49606`; human-readable product presentation `Fix-Am Admix 300 Polymer Emulsion Based Mortar`; re-fetch/reprint of that same completed sale with no second commercial effect observed; historic receipt `49585` unchanged. This does not prove R9, live electronic payment, real refund/restock, browser thermal print layout, Sell customer-picker search, Returns Orders handoff, or sale-time customer-name snapshots. |
| R9 / PR #63 | Draft / later. Most implementation exists; installed-device/update/reconnect/multi-tab/Z-report acceptance remains incomplete. Do not begin R9 reconciliation in this assignment. |
| #82–#85 | OPEN P0 production-MVP follow-ups. Visible R10 GO/NO-GO blockers unless later owner authority explicitly waives them. Not implemented here. |
| #86–#87 | OPEN P1 staging-reliability follow-ups. Visible in qualification truth; not automatically classified as production blockers by this preparation. Not implemented here. |
| #88 | OPEN P2 documented historical limitation: pre-REC-01 receipt UUID-like line presentation must remain immutable. Not corruption and not a rewrite job. Not implemented here. |
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
- **PENDING_STG01** — historical status only; do not assign it to new rows because STG-01 is accepted on `c320be8c...` and REC-01 is accepted on `7c5d6ca0...`. Use **REUSE_EXISTING_EVIDENCE** for accepted STG-01/REC-01 evidence and **PREPARED** where a distinct final-candidate/failure exercise still remains.
- **PENDING_REC01** — historical status only; do not assign it to new rows. REC-01 / PR #80 is accepted for the exercised snapshot/reprint behavior only.
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
