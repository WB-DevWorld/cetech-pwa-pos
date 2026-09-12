# Task index

CP-04 dependency interpretation: [ADR-011](../decisions/ADR/011.md). Its development baseline is SATISFIED for local CORE-01/BR-01 implementation; issue #4 stays OPEN for operation-specific write-safety/cutover evidence. An open tracker is not a blanket dependency failure. [Remaining actions](../runbooks/CP-04-REMAINING-WORK.md).

All 30 GitHub issues were created and confirmed on 2026-09-11. Senior issues are assigned to @wbdevworld; WS1/WS2 remain unassigned pending verified identities. Full scoped execution contracts live in each workstream TASKS.md.

| ID | Task | Owner | Dependencies | Milestone |
| --- | --- | --- | --- | --- |
| [CP-01 #1](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/1) | Bootstrap repository control plane | WS3 | none | M0 |
| [CP-02 #2](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/2) | Reconcile architecture and decision freeze | WS3 | [CP-01 #1](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/1) | M0 |
| [CP-03 #3](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/3) | Freeze domain and wire contracts | WS3 | [CP-02 #2](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/2) | M0 |
| [CP-04 #4](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/4) | Audit live environment and isolate staging | WS3 | [CP-01 #1](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/1) | M0 |
| [CP-05 #5](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/5) | Pin toolchain and create Next.js/CI scaffold | WS3 | [CP-03 #3](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/3) | M0 |
| [FE-01 #6](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/6) | Intake approved prototype and map scenarios | WS1 | [CP-03 #3](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/3) | M0 |
| [FE-02 #7](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/7) | Convert tokens and responsive POS shell | WS1 | FE-01, CP-05 | M1 |
| [FE-03 #8](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/8) | Build Sell cart barcode and customer workflow | WS1 | FE-02, CORE-04 | M1 |
| [FE-04 #9](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/9) | Integrate quote states and checkout eligibility | WS1 | FE-03, BR-05 | M1 |
| [FE-05 #10](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/10) | Integrate cash checkout and receipt UX | WS1 | FE-04, CORE-05, BR-06 | M1 |
| [FE-06 #11](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/11) | Implement payment returns and register states | WS1 | FE-05, PAY-01, RT-01 | M2 |
| [FE-07 #12](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/12) | Finish Store Health and responsive PWA recovery UX | WS1 | FE-05, CORE-07 | M2 |
| [BR-01 #13](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/13) | Build bridge health and permission skeleton | WS2 | CP-03, CP-04 | M0 |
| [BR-02 #14](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/14) | Implement isolated Woo runtime quote spike | WS2 | [BR-01 #13](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/13) | M1 |
| [BR-03 #15](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/15) | Prove WoodMart tier pricing parity | WS2 | [BR-02 #14](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/14) | M1 |
| [BR-04 #16](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/16) | Prove B2BKing commercial parity | WS2 | [BR-02 #14](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/14) | M1 |
| [BR-05 #17](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/17) | Resolve plugin overlap and pass pricing gate | WS2 | BR-03, BR-04 | M1 |
| [BR-06 #18](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/18) | Implement HPOS-safe idempotent prepare and resolve | WS2 | BR-05, CORE-01 | M1 |
| [BR-07 #19](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/19) | Implement verified commercial finalization and cancel | WS2 | BR-06, CORE-05 | M1 |
| [CORE-01 #20](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/20) | Create POS operational schema and RLS | WS3 | CP-04 development baseline, CP-05 | M1 |
| [CORE-02 #21](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/21) | Implement staff auth abstraction and permission boundary | WS3 | CP-05, CORE-01 | M1 |
| [CORE-03 #22](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/22) | Wire BFF health and bridge connectivity | WS3 | CORE-02, BR-01 | M1 |
| [CORE-04 #23](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/23) | Implement catalog projection and durable local journal | WS3 | CORE-01, CORE-03 | M1 |
| [CORE-05 #24](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/24) | Build cash and FinalizeSale orchestration | WS3 | CORE-03, CORE-01, CP-03 | M1 |
| [CORE-06 #25](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/25) | Integrate real cash sale and contract/E2E harness | WS3 | FE-05, BR-07, CORE-05 | M1 |
| [PAY-01 #26](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/26) | Implement verified electronic payment and reconciliation | WS3 | CORE-06, CP-04 | M2 |
| [RT-01 #27](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/27) | Freeze refund wire refinement and implement safe returns | WS3 | PAY-01, BR-07 | M2 |
| [CORE-07 #28](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/28) | Implement safe PWA lifecycle and operational close | WS3 | [CORE-06 #25](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/25) | M2 |
| [QA-01 #29](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/29) | Run failure security and invariant qualification | WS3 | FE-06, FE-07, CORE-07, RT-01 | M2 |
| [REL-01 #30](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/30) | Rehearse cutover and execute approved pilot | WS3 | [QA-01 #29](https://github.com/WB-DevWorld/cetech-pwa-pos/issues/29) | M3 |
