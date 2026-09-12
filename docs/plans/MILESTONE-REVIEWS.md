# Ten remaining milestone reviews

Authority: [ADR-012](../decisions/ADR/012.md); operation: [LONG-RUNNING-WORK](LONG-RUNNING-WORK.md). Snapshot 2026-09-12: main `aa08d74f2cb99301817e5995f01486acb7e2169f`; R1/#40 MERGED; #41 preparation open. Refresh before acting. Ten earlier-plus-R1 PRs are merged; this is the remaining MVP budget, not repository lifetime count. No completed foundation is recreated.

| Review | Outcome | Ordered task IDs | Existing PR | Acceptance gate |
| --- | --- | --- | --- | --- |
| R1 | Operational schema/RLS and workflow adoption | CORE-01 | #40 MERGED `aa08d74f…` | Fresh migration, supported upgrade baseline, grants/RLS positive and negative tests; preserved commerce boundary; workflow/tooling checks. ACCEPTED. |
| R2 | Authentication, bridge health and BFF | BR-01, CORE-02, CORE-03 | [#43](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/43) DRAFT `batch/r2-auth-bridge-bff` | CORE-02 CHECKPOINTED `2f6c0b5…`. BR-01 `280a73d…` imported as `0ac2e38…` (INTEGRATED_AND_TESTED; LIVE_ACCEPTANCE_PENDING). CORE-03 CODE_COMPLETE_REMOTE_ACCEPTANCE_PENDING. Live CP04-W4 still required. R2 gate not passed. Keep draft; do not request review yet. |
| R3 | Authoritative Woo/WoodMart/B2BKing parity | BR-02, BR-03, BR-04, BR-05 | Create when this milestone is assembled | Guest/retail/quantity tiers/B2B/customer/variation/overlap/tax parity in controlled runtime. Unexplained mismatch blocks checkout. |
| R4 | Catalog/barcode/Sell/customer/quote states | CORE-04, FE-03, FE-04 | #41 | CORE-04 projection and journal consumed by FE-03; FE-04 quote states after R3. Preparation UI alone is insufficient. |
| R5 | Idempotent preparation and cash orchestration | BR-06, CORE-05 | Create when this milestone is assembled | Concurrent/repeated prepare; changed quote/stock; lost response; CORE-05 uses frozen mock boundary without waiting for BR-07. |
| R6 | First complete real cash sale | BR-07, FE-05, CORE-06 | Create when this milestone is assembled | Login/register/scan/customer/quote/one order/cash/stock/receipt/POS record; failure resolution across real adapters. |
| R7 | Electronic payment and reconciliation | PAY-01 | Create when this milestone is assembled | Server verification binds amount/currency/order; duplicate/out-of-order callbacks; pending and reconciliation; authorized sandbox. |
| R8 | Returns and payment/register UI states | RT-01, FE-06 | Create when this milestone is assembled | RT-01 contract refinement then named WS2 refund subtask; authorized refunds/restock/replay; FE-06 payment/register states. Live close proof is R9. |
| R9 | PWA recovery, operational close, Store Health | CORE-07, FE-07 | Create when this milestone is assembled | Update/crash/reconnect retain intent; old installed client/multi-tab; atomic blind close and immutable Z once; variance retained. |
| R10 | Failure qualification, rehearsal and release preparation | QA-01, REL-01 | Create when this milestone is assembled | Combined failure/security/physical hardware/latency/restore/rehearsal and VitePOS queue/shift evidence; human pilot approval. |

Registry: `.github/bootstrap/tasks.json`. These 23 tasks cover the remaining original implementation queue once; CP-01/02/03 baseline exists under approved ADRs although issues remain open, CP-05/FE-01/FE-02 are merged. CP-04 is an operation-specific ongoing evidence tracker, not falsely completed by this mapping. R1 also includes this explicitly authorized governance/tooling scope without changing the original 30 task IDs.

Review order is not a universal implementation barrier. CORE-07 can proceed after CORE-06 concurrently with payment/returns; R4 preparation can proceed alongside parity within declared mock boundaries. Within a batch accepted unchanged contracts and an explicitly recorded tested provisional SHA allow sequential collaboration. New contracts need their existing approval process. No implicit CORE-05/BR-07 dependency cycle.

R1/#40 was evaluated before editing: the latest head is open, Ben's final review is pending, and workflow adoption was expressly assigned to R1. Add a separate governance commit, preserve existing SQL/RLS, and require review of the combined final head. No extra PR is needed now. #41 is retained for R4; its current preparation-only scope is not silently converted into completed runtime integration.

Domain suites arrive in the same milestone as their code: PHP/capability/HPOS negatives with bridge code, real parity with R3, preparation/concurrency with R5, integrated sale with R6, provider callback/verification with R7, refund invariants with R8, installed PWA/close with R9. R10 is qualification, not first integration. Missing suites are not PASS. CI command registration remains in TOOLCHAIN and each task's acceptance.

If scope is unreviewable, split it, document risk and new budget, and keep all checks/reviews. No unconditional sixty-hour completion claim. The next live assignment and leases are only in CURRENT-WORK; this table is not a second scheduler.
