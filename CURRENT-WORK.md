# Current work ledger

Updated 2026-09-14. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `da86434cc471703b8309cea77cda88b7845c299b` — PRE-R5 PR #51 merge; protected.
- ADR-012 and ADR-014 are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Explicit implementation reassignments: **NONE**.

## Active assignment — R5 idempotent prepare + cash

- Integration issue: **#52 R5-00**.
- Milestone PR: **#53** — `[R5] Idempotent prepare and cash orchestration`.
- Neutral branch: `batch/r5-idempotent-prepare-cash`.
- Integration editor: `@wbdevworld` / WS3.
- Activation baseline: `main` `da86434cc471703b8309cea77cda88b7845c299b`.
- Milestone state: **REMEDIATED / AWAITING FINAL EXACT-HEAD CI + FRESH_2 + BEN RE-REVIEW**.

### R5 provenance

| Step | Task | Owner | Source / integration | State |
| --- | --- | --- | --- | --- |
| 1 | BR-06 / #18 | `@Emmanuel-coder-prog` / WS2 | accepted source `a0fa00d452c3a672d97c5a3cb253a5ca6f11cf8f`; import merge `30af336925fd29dc43e7315d81919ae2a7bd5bfc` | **ACCEPTED / IMPORTED** |
| 2 | BR-06 combined handoff | WS3 integration | `BR06_INTEGRATION_SHA=15baab1b47a35902b8a3ddde989df55cc4b25436`; CI `34855313462` SUCCESS | **VERIFIED** |
| 3 | CORE-05 / #24 initial accepted source | `@wbdevworld` / WS3 | replacement implementation `7226b686982b3da8746526aa8f60744a8b53ab25`; source head `5c5c93f523ac9a5218cc916a8a6b6503cca4df75`; import merge `53b3982772b35886b3ac0fa0d50e374e9e359752` | **SUPERSEDED BY REVIEW REMEDIATION** |
| 4 | Ben review blocker | `@Ben-001-sys` | `CHANGES_REQUESTED` on R5 head `f0ddc31f1ee1d9cd69768049ec33da839ab8185a`: fresh-key existing-payment path bypassed cash mismatch validation | **REMEDIATED** |
| 5 | CORE-05 Ben-review fix | `@wbdevworld` / WS3 | source `80414c6396832b9f9ec209cdec6e73ab19cd160a`; source CI `34870285209` SUCCESS; owner handoff FRESH_2 | **ACCEPTED / IMPORTED** |
| 6 | CORE-05 remediation import | WS3 integration | merge `bc14b1e860a992ba432ff752f3ab15e4ad5c1001`; combined CI `34870882712` SUCCESS | **VERIFIED** |
| 7 | Final R5 review gate | independent competent human | exact final integration-control head after this ledger commit | **PENDING BEN RE-REVIEW** |

The Ben-review remediation validates sale/org/location/economic invariants before the existing-payment shortcut. A fresh idempotency key may reuse prior cash evidence only when the recorded `saleId`, amount and exact `cashReceived` match. Wrong currency, underpayment, and materially different cash received fail closed without a second `cash_sale` ledger effect. Same-key replay/repair remains intact.

Frozen v1.0.0 contracts and ADRs remain unchanged. BR-06 is not reopened.

## Final R5 gate

Before review/merge:
1. required CI must pass on the exact final integration-control head;
2. perform exactly two final ADR-012 freshness observations after that head is frozen;
3. no Pass 3;
4. re-request `@Ben-001-sys` on that exact replacement head;
5. no self-approval or automatic merge.

R6 / BR-07 / FE-05 / CORE-06 are **NOT STARTED / NOT AUTHORIZED BY THIS R5 SESSION**. BR-07 remains the real commercial finalizer; CORE-05 uses the explicitly permitted mock boundary. Live HPOS/real DB concurrency and production promotion remain later runtime/release evidence and are not claimed here.
