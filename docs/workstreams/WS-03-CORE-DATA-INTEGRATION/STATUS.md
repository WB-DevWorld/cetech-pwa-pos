# WS3 current status

Snapshot 2026-09-17. Protected `main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` is accepted/merged R8 PR #69. Post-merge CI `35216668259` SUCCESS. R9 is the active reconciliation candidate on `batch/r9-pwa-recovery-operational-close` / PR **#63** (DRAFT).

## R6 (historical)

PR #55 merged as `bd79c2901ce33c3177141d4244cc196be0a719d2`. CORE-06 / #25, R6-00 / #54, and CORE-HARDEN-07 / #56 closed completed. Woo `49439` retained as historical cash evidence. Production promotion is not authorized. Issue #4 remains OPEN.

## R7 (merged)

PR #58 squash-merged as `1feb78db36f33e0254c0170396f30112d71577ea`. PAY-01 / #26 and #57 are accepted on `main`. Post-merge CI `35136321143` SUCCESS.

Paystack TEST sandbox evidence remains `docs/integration/evidence/R7-PAY-01-SANDBOX.md` (Woo **49449**). Monotonic concurrency evidence remains `docs/integration/evidence/R7-PAY-01-CONCURRENCY.md`. Live Paystack is still not authorized.

## R8 (merged)

PR #69 squash-merged as `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`. Fail-closed historic return lookup and fail-closed shift variance remain in force. Historical R8 working branch `batch/r8-safe-returns-reconciliation` and PR #69 chronology are provenance only.

## R9 (active, DRAFT)

Mode: RECONCILE / INTEGRATE. Owner `@wbdevworld` / WS3. Branch `batch/r9-pwa-recovery-operational-close`. Milestone PR **#63**; keep DRAFT; do not self-approve; do not merge; do not close CORE-07.

Task `R9-REC-01` reconciles reviewed CORE-07 + FE-07 onto final R8 `main`. Historical pre-reconciliation head `13af56ca86d13657736b8c5156b73a8e79664130` was based on R6 `bd79c290…`. Independent review of that head is provenance only.

Code reconciliation is not runtime-device acceptance. Installed-client/device evidence is still pending. R10 / QA-01 is **not started**.

| Role | SHA / classification |
| --- | --- |
| Current `main` / accepted R8 | `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` ACCEPTED / MERGED |
| Historical accepted R7 | `1feb78db36f33e0254c0170396f30112d71577ea` ACCEPTED / MERGED |
| Historical R6 | `bd79c2901ce33c3177141d4244cc196be0a719d2` |
| Historical R9 head (pre-reconciliation) | `13af56ca86d13657736b8c5156b73a8e79664130` |
| Reconciliation evidence | `docs/integration/evidence/R9-R8-RECONCILIATION.md` |

Production, live Paystack, live refund/restock, and VitePOS deactivation remain NOT AUTHORIZED.

## Remaining disposition

Independent review of PR #63 on the **new** reconciled exact head after CI. Installed-client/device runtime evidence remains a later gate. Do not claim `FRESH_2` in this reconciliation pass (`NOT FINAL FRESHNESS`). Stop at `R9_RECONCILED_CODE_READY_FOR_REVIEW`.
