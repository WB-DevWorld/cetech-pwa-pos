# WS3 current status

Snapshot 2026-09-14. PRE-R5 hardening remains **APPROVED / MERGED / POST-MERGE VERIFIED** on `main` `da86434cc471703b8309cea77cda88b7845c299b`.

## R5

R5 is **REMEDIATED / AWAITING FINAL EXACT-HEAD CI + FRESH_2 + BEN RE-REVIEW** on issue #52 and PR #53 / `batch/r5-idempotent-prepare-cash`.

- BR-06 / #18 — `@Emmanuel-coder-prog` / WS2: accepted source `a0fa00d452c3a672d97c5a3cb253a5ca6f11cf8f`; import `30af336925fd29dc43e7315d81919ae2a7bd5bfc`; tested `BR06_INTEGRATION_SHA=15baab1b47a35902b8a3ddde989df55cc4b25436`; CI `34855313462` SUCCESS. **UNCHANGED / ACCEPTED.**
- CORE-05 / #24 — `@wbdevworld` / WS3: initial remediated source `5c5c93f523ac9a5218cc916a8a6b6503cca4df75` was imported as `53b3982772b35886b3ac0fa0d50e374e9e359752`; Ben then requested one narrow fresh-idempotency-key cash-evidence fix on R5 head `f0ddc31f1ee1d9cd69768049ec33da839ab8185a`.
- Ben-review CORE-05 fix: source `80414c6396832b9f9ec209cdec6e73ab19cd160a`; source CI `34870285209` SUCCESS; source handoff FRESH_2; imported as `bc14b1e860a992ba432ff752f3ab15e4ad5c1001`; combined CI `34870882712` SUCCESS.

The fresh-key cash blocker is closed: sale/org/location/economic invariants are checked before existing-payment reuse, and a fresh key can reuse recorded cash evidence only when `saleId`, amount and exact `cashReceived` match. Wrong currency, underpayment and materially different cash received fail closed without a second cash ledger effect.

Frozen contracts v1.0.0 and ADRs remain unchanged. Issue #4 remains OPEN. `pricingParityVerified=false`. BR-07 remains future R6 work; CORE-05 still uses the authorized mock boundary. No production promotion is authorized.

Next exact action: freeze the final integration-control head, require exact-head CI, perform exactly two final ADR-012 freshness observations, and re-request `@Ben-001-sys` on that exact head. No Pass 3. No self-approval. R6 remains NOT STARTED.
