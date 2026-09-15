# WS3 current status

Snapshot 2026-09-15. R5 remains APPROVED / MERGED. `main` `bc606a690f0c167b7057e3ae9143337404275882`.

## R6

Draft PR #55 / `batch/r6-first-real-cash-sale`. Combined implementation SHA `e64b0fa…`. Scheduler head this authority is recorded against: `eac32cdff60f0f6ed80bb0908f9091543c859ead`.

Ben COMMENTED on `eac32cd…` (not approval): CORE-06 path-scope breach; missing durable runtime.

**R6-REM-01** temporary ADR-014 lease is active for `@wbdevworld` / WS3. Not retroactive. Evidence: `docs/integration/evidence/R6-REM-01-AUTHORITY.md`.

Next: publish this checkpoint, then implement durable `StaffAssignmentDirectory` + `CheckoutStore` on `ws3/r6-rem-01-durable-runtime`. Do not merge PR #55. Do not start R7.
