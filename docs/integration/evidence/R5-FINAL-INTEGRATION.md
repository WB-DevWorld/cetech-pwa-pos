# R5 final integration handoff — Ben-review remediation

Date: 2026-09-14 UTC
Milestone: R5 — Idempotent preparation and cash orchestration
PR: #53
Integration issue: #52
Neutral branch: `batch/r5-idempotent-prepare-cash`
Base main: `da86434cc471703b8309cea77cda88b7845c299b`

## Stable predecessor — BR-06 / #18

- Owner: `@Emmanuel-coder-prog` / WS2
- Accepted source: `a0fa00d452c3a672d97c5a3cb253a5ca6f11cf8f`
- Import merge: `30af336925fd29dc43e7315d81919ae2a7bd5bfc`
- Tested handoff: `15baab1b47a35902b8a3ddde989df55cc4b25436`
- CI `34855313462`: SUCCESS both required jobs
- BR-06 remains accepted and was not reopened.

## CORE-05 / #24

Initial accepted owner remediation:
- implementation `7226b686982b3da8746526aa8f60744a8b53ab25`
- contributor head `5c5c93f523ac9a5218cc916a8a6b6503cca4df75`
- import `53b3982772b35886b3ac0fa0d50e374e9e359752`
- exact integration-control review head `f0ddc31f1ee1d9cd69768049ec33da839ab8185a`

Ben review result on that head: **CHANGES_REQUESTED** for one narrow cash-evidence issue. Existing-payment reuse under a fresh Idempotency-Key occurred before validating the new cash request's currency/amount/evidence.

Remediation:
- source fix `80414c6396832b9f9ec209cdec6e73ab19cd160a`
- source CI `34870285209`: SUCCESS Linux + Windows
- source freshness: FRESH_2
- integration import `bc14b1e860a992ba432ff752f3ab15e4ad5c1001`
- integration CI `34870882712`: SUCCESS both required jobs

The fix validates sale/org/location/economic invariants before reuse. Existing verified cash may be reused by a fresh key only when recorded sale/amount and exact `cashReceived` match. Wrong currency, underpayment and materially different cash received are rejected. Exact matching evidence reuses the existing payment without another cash ledger effect. Same-key replay/repair remains unchanged.

## Remaining R5 gate

This document accompanies an integration-control-only replacement review commit; no runtime code changes after the `bc14b1e…` import.

Required next steps:
1. CI SUCCESS on the exact replacement integration-control head;
2. exactly two final ADR-012 freshness observations of `main`, R5, BR-06, CORE-05 and PR #53;
3. no Pass 3;
4. update PR #53 metadata with the new exact head/FRESH_2 evidence;
5. re-request `@Ben-001-sys` for independent review;
6. no self-approval or automatic merge.

Frozen v1.0.0 contracts and ADRs remain unchanged. Issue #4 remains OPEN. `pricingParityVerified=false`. R6 / BR-07 / FE-05 / CORE-06 remain NOT STARTED. No production promotion authority is granted.
