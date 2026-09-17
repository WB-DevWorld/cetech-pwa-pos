# WS3 current status

Snapshot 2026-09-16. Protected `main` `1feb78db36f33e0254c0170396f30112d71577ea` is accepted/merged R7 PR #58. Post-merge CI `35136321143` SUCCESS. R8 is the active reconciliation/review milestone on `batch/r8-safe-returns-reconciliation` / PR #69.

## R6 (historical)

PR #55 merged as `bd79c2901ce33c3177141d4244cc196be0a719d2`. CORE-06 / #25, R6-00 / #54, and CORE-HARDEN-07 / #56 closed completed. Woo `49439` retained as historical cash evidence. Production promotion is not authorized. Issue #4 remains OPEN.

## R7 (merged)

PR #58 squash-merged. PAY-01 / #26 and #57 are accepted on `main`. Historical provisional R7 head `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091` is not current authority; it is used only to identify the R8-only delta.

Paystack TEST sandbox evidence remains `docs/integration/evidence/R7-PAY-01-SANDBOX.md` (Woo **49449**). Monotonic concurrency evidence remains `docs/integration/evidence/R7-PAY-01-CONCURRENCY.md`. Live Paystack is still not authorized.

## R8 (active)

Mode: INTEGRATE / REMEDIATE. Owner `@wbdevworld` / WS3. Branch `batch/r8-safe-returns-reconciliation`. Milestone PR **#69**; do not self-approve; do not merge.

Starting exact head `79dab6096466e00fd8289300038f07619868f539`: Ben APPROVED; Emmanuel CHANGES_REQUESTED. R8-02 remediates Emmanuel's two runtime blockers (durable return `orderLineId` lookup; fail-closed shift variance). Prior R8-01 chronology is preserved in `docs/integration/evidence/R8-REVIEW-REMEDIATION.md`. R9 is not imported.

| Role | SHA / classification |
| --- | --- |
| Current `main` / accepted R7 | `1feb78db36f33e0254c0170396f30112d71577ea` ACCEPTED / MERGED |
| Historical provisional R7 (R8 delta base only) | `9ab7e5b7cf2b5d4f253f9d41468726c31cbfc091` |
| Accepted RT-01 contract / ADR-015 | `58d385300bfba784435448029e88f07742048cde` |
| Accepted WS3 RT-01 runtime | `4650a0fa18c909743e9fbab4be0b6067bd1eff18` |
| Accepted BR-08 / WS2 source | `dcf9098a331f878647e067fc78b3c05778f8f668` CLOSED / COMPLETED |
| Accepted FE-06 / WS1 source | `0ddde7c727337c4005e9878071817bbf826d41a2` CLOSED / COMPLETED |
| Combined downstream receiver | `d54a916946a6dcf0dfbc636d93528ac58a77ca1b` |
| Accepted downstream R8 head | `5fa875eb43c0b2f62b59b80a3dfa3812c2d1e190` |

R9 is not started. Production, live Paystack, live refund/restock, and VitePOS deactivation remain NOT AUTHORIZED.

## Remaining disposition

Independent review of PR #69 on the **new** exact remediation head after CI. Ben confirms no regression to the previously approved WS2/WS3 surface; Emmanuel verifies immutable return-line identity and fail-closed shift variance. Do not dismiss Ben's `APPROVED` on `79dab609…` or Emmanuel's `CHANGES_REQUESTED`. Controlled real training refund/restock remains an unexecuted remaining gate.
