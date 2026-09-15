# WS3 current status

Snapshot 2026-09-15. R5 remains APPROVED / MERGED. `main` `bc606a690f0c167b7057e3ae9143337404275882`.

## R6

Draft PR #55 / `batch/r6-first-real-cash-sale`. R6-REM-01 authority checkpoint `f547542ca23efaf61243909c320d7dd900709188`.

Ben COMMENTED on `eac32cd…` (not approval): CORE-06 path-scope breach; missing durable runtime. Authority is **not retroactive**.

**R6-REM-01 durable runtime** is implemented on `ws3/r6-rem-01-durable-runtime`. Evidence: `docs/integration/evidence/R6-REM-01-DURABLE-RUNTIME.md`.

Next: import exact tested remediation commits onto `batch/r6-first-real-cash-sale`, combined gate, then authorized training sale. Do not merge PR #55. Do not start R7.
