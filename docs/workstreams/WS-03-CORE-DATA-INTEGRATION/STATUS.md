# WS3 current status

Snapshot 2026-09-15. R5 remains APPROVED / MERGED. `main` `bc606a690f0c167b7057e3ae9143337404275882`.

## R6

Draft PR #55 / `batch/r6-first-real-cash-sale`. Do not merge. Do not start R7. Production promotion is not authorized. Issue #4 remains OPEN.

R6-REM-02 imported. Combined automated gate PASS on `82a85f4082f461a2709ccfece9a73e4e8872d3d3`. Previous `FRESH_2` on `f6f57cc…` is historical; replacement FRESH_2 is still required after this evidence commit and exact-head CI.

| Role | SHA |
| --- | --- |
| Reviewed head | `f6f57cc39b77dd576734a5b8fb5f89be3027c44c` |
| Authority | `922720ccbc9e12c535c765c44f1dfea887b19ccc` |
| Source | `edafe1e64c869528f57eb8e4bba8b317b33a46c4` |
| Import | `82a85f4082f461a2709ccfece9a73e4e8872d3d3` |

Ben blocker resolved: durable `sale.prepare` scope binding; remote Woo resolve only after local trusted scope. Emmanuel blocker 1 resolved: only `SaleResolution.status === "completed"` confirms commerce. Emmanuel blocker 2 resolved: pre-effect cash validation does not consume the FE-05 key. No FE-05 source change. No BR-07 source change. No second staging sale. Woo `49439` retained.

Evidence: `docs/integration/evidence/R6-REM-02-AUTHORITY.md`, `R6-REM-02-SOURCE.md`, `R6-REM-02-IMPORT.md`.
