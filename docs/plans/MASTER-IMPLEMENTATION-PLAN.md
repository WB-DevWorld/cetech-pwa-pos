# Master implementation plan

60 elapsed development hours; three humans, separate accounts/worktrees, shared authority. Start time UNVERIFIED until kickoff. Scope is governed by correctness and gates, not exhausted hours.

| Phase | Objective | Workstreams active / parallel tasks | Dependencies | Shared artifacts | Integration point | Acceptance gate | Blockers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H0–4 / M0 | Engineering control plane, contracts, staging facts and scaffold | WS3 CP-01–05; WS1 FE-01; WS2 CP-04 evidence/BR-01 once ready | Supplied sources, GitHub, human live access | ADRs, v1 schema, immutable reference, toolchain | One baseline for three Cursor accounts | Control-plane readiness; exact scope owners | Missing identities/access/protection recorded; staging credentials gate bridge only |
| H4–12 / M1a | Health and authoritative pricing proof | WS2 BR-02–05; WS3 CORE-01–03; WS1 FE-02 mock shell | Contract freeze, isolated staging, scaffold | Quote fixtures, errors, RLS/session boundary | Browser→BFF→Supabase/bridge/Woo | Pricing parity matrix passes before transaction logic | Any unexplained quote/tax/overlap mismatch |
| H12–20 / M1b | Catalog, barcode and idempotent prepare | WS3 CORE-04/05 mocked integration; WS1 FE-03/04; WS2 BR-06 | Parity and verified stock/barcode facts for live paths | Projections, journal, prepared sale | Live customer/cart→quote→prepare | One order under replay/crash; last-unit online/POS race | Unproven multi-stock or dedupe/reservation behavior |
| H20–28 / M1c | First real cash slice | WS1 FE-05; WS2 BR-07; WS3 CORE-05/06 | Prepare and cash ledger | Verified cash evidence, receipt, sale state | Staff→register→scan→customer→quote→cash→stock→receipt | One order/tender/stock effect/receipt, recoverable partial writes | Any duplicate or lost money/stock/workflow |
| H28–44 / M2 | Electronic tender, returns, close, PWA | WS3 PAY-01/RT-01/CORE-07; WS1 FE-06/07; WS2 owned refund subtask after contract refinement | Cash slice; provider/policy facts | Refund contract revision, release policy, RLS tests | Same workflows across payment/refund/close/recovery | Pending/late/duplicate money and installed-PWA safety | Unknown provider/tax/approval/hardware facts |
| H44–52 / M2 | Failure/security/performance qualification | All execute evidence in owned paths; WS3 QA-01 | Enabled capabilities integrated | Invariant report, staging artifacts | Frozen release candidate | No release blocker; negative/RLS/failure evidence | Gate failures consume feature scope/buffer, not waived |
| H52–60 / M3 | Rehearsal, restore proof and controlled pilot | All assist owned runtime checks; WS3 REL-01, human release owner | Qualified candidate and business signoff | Cutover sheet, backup/rollback, queue/stock snapshots | One pilot register with controlled writer switch | Explicit human GO; monitoring/rollback available | Statutory invoice/queue/stock discrepancy = NO-GO |

Testing is embedded in every task; H44–52 is failure/release qualification, not the first testing allocation. Checkpoint at H12/H28/H44: reduce optional scope or delay production if gates slip. A cash-only launch is possible only after an explicit business scope decision; do not silently remove required tenders/returns or their safe operational alternative.

Critical path: control plane → contracts → browser/BFF/Supabase/Woo health → authoritative Woo/WoodMart/B2BKing quote → pricing parity → catalog/barcode → Sell → idempotent prepare → cash → electronic payment → returns → shift close → PWA recovery → failure/reconciliation → rehearsal → VitePOS cutover.

Mock shell, RLS and reference mapping can advance independently. Dependent live checkout cannot be built on guessed pricing. Merge order and evidence in docs/integration; task scopes in workstream packages.

## Long-running workflow amendment (2026-09-12)

[ADR-012](../decisions/ADR/012.md) and [LONG-RUNNING-WORK](LONG-RUNNING-WORK.md) control approved batch continuation and final two-pass freshness. [R1–R10](MILESTONE-REVIEWS.md) groups existing tasks without recreating completed foundation. CURRENT-WORK and each workstream TASKS/STATUS/HANDOFF determine the live assignment. Team-wide activation follows the reviewed R1/#40 merge. Existing task stop clauses apply only where not superseded by a declared approved batch.
