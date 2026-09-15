# WS3 current status

Snapshot 2026-09-15. R5 remains APPROVED / MERGED. `main` `bc606a690f0c167b7057e3ae9143337404275882`.

## R6

Draft PR #55 / `batch/r6-first-real-cash-sale`. Reviewed head `f6f57cc39b77dd576734a5b8fb5f89be3027c44c`. Do not merge. Do not start R7. Production promotion is not authorized. Issue #4 remains OPEN.

Ben and Emmanuel **REQUEST_CHANGES** on `f6f57cc…`. **R6-REM-02** temporary ADR-014 lease is active for `@wbdevworld` / WS3. It does not rewrite R6-REM-01. Evidence: `docs/integration/evidence/R6-REM-02-AUTHORITY.md`.

Historical training sale (not to be repeated): Woo `49439`, stock 6→5, receipt `rcpt-53478b8d`. Evidence: `docs/integration/evidence/R6-TRAINING-REAL-SALE.md`.

Next: publish this checkpoint, then implement transaction-scope binding, finalize `completed`-only confirmation, and cash pre-effect validation on `ws3/r6-rem-02-final-review-security`.
