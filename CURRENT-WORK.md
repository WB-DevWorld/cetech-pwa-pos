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
- Milestone state: **ASSEMBLED / AWAITING FINAL EXACT-HEAD CI + FRESH_2 + INDEPENDENT REVIEW**.

### R5 provenance

| Step | Task | Owner | Source / integration | State |
| --- | --- | --- | --- | --- |
| 1 | BR-06 / #18 | `@Emmanuel-coder-prog` / WS2 | accepted source `a0fa00d452c3a672d97c5a3cb253a5ca6f11cf8f`; import merge `30af336925fd29dc43e7315d81919ae2a7bd5bfc` | **ACCEPTED / IMPORTED** |
| 2 | BR-06 combined handoff | WS3 integration | `BR06_INTEGRATION_SHA=15baab1b47a35902b8a3ddde989df55cc4b25436`; CI `34855313462` SUCCESS | **VERIFIED** |
| 3 | CORE-05 / #24 | `@wbdevworld` / WS3 | replacement implementation `7226b686982b3da8746526aa8f60744a8b53ab25`; source head `5c5c93f523ac9a5218cc916a8a6b6503cca4df75` | **ACCEPTED / IMPORTED** |
| 4 | CORE-05 import | WS3 integration | merge `53b3982772b35886b3ac0fa0d50e374e9e359752`; combined CI `34867174407` SUCCESS | **VERIFIED** |
| 5 | Final R5 review gate | independent competent human | exact final head after this integration-control commit | **PENDING** |

CORE-05 remediation closed the integration blockers: CORE-02 assignment-role/register authorization is used; critical POS persistence failures converge through `requires_attention` repair with the same logical idempotency key; the cash-sale uniqueness migration is reset/pgTAP validated; the out-of-scope Vitest config edit was reverted. Frozen v1.0.0 contracts and ADRs remain unchanged.

## Final R5 gate

Before review/merge:
1. required CI must pass on the exact final integration-control head;
2. perform exactly two final ADR-012 freshness observations after that head is frozen;
3. no Pass 3;
4. request a different competent human to review that exact head;
5. no self-approval or automatic merge.

R6 / BR-07 / FE-05 / CORE-06 are **NOT STARTED / NOT AUTHORIZED BY THIS R5 SESSION**. BR-07 remains the real commercial finalizer; CORE-05 uses the explicitly permitted mock boundary. Live HPOS/real DB concurrency and production promotion remain later runtime/release evidence, not silently claimed here.
