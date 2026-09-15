# WS3 current status

Snapshot 2026-09-15. R5 remains APPROVED / MERGED. `main` `bc606a690f0c167b7057e3ae9143337404275882`.

## R6

Draft PR #55 / `batch/r6-first-real-cash-sale`. Do not merge. Do not start R7. Production promotion is not authorized. Issue #4 remains OPEN.

R6-REM-02 imported. Combined automated gate PASS. Exact-head CI PASS on freeze candidate `3f702f2353a3b9911dd0571e59e8cc2fbeefa535`. Replacement **FRESH_2** recorded in `docs/integration/evidence/R6-REM-02-FRESHNESS.md`. Historical `FRESH_2` on `f6f57cc…` remains valid only for the pre-remediation reviewed head.

| Role | SHA |
| --- | --- |
| Reviewed head | `f6f57cc39b77dd576734a5b8fb5f89be3027c44c` |
| Authority | `922720ccbc9e12c535c765c44f1dfea887b19ccc` |
| Source | `edafe1e64c869528f57eb8e4bba8b317b33a46c4` |
| Import | `82a85f4082f461a2709ccfece9a73e4e8872d3d3` |
| Freeze candidate (pre-freshness docs) | `3f702f2353a3b9911dd0571e59e8cc2fbeefa535` |

Ben blocker resolved. Emmanuel blockers 1 and 2 resolved. No FE-05 source change. No BR-07 source change. No second staging sale. Woo `49439` retained.

The freshness evidence commit produces a later exact head that must have its own green required workflows.
