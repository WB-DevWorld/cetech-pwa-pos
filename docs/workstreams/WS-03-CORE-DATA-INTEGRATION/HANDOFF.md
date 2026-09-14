# WS3 current handoff — R5 Ben-review remediation integrated

Kind: INTEGRATION_CHECKPOINT. Date: 2026-09-14 UTC.

Task / batch / workstream: R5 / issue #52; BR-06 #18 + CORE-05 #24; WS3 integration editor.
Owner / integration editor: `@wbdevworld` / WS3.
Branch / PR: `batch/r5-idempotent-prepare-cash` / PR #53.
Base main: `da86434cc471703b8309cea77cda88b7845c299b`.

## BR-06

Owner / implementer: `@Emmanuel-coder-prog` / WS2.
Accepted source: `a0fa00d452c3a672d97c5a3cb253a5ca6f11cf8f`.
Import merge: `30af336925fd29dc43e7315d81919ae2a7bd5bfc`.
Tested handoff: `BR06_INTEGRATION_SHA=15baab1b47a35902b8a3ddde989df55cc4b25436`.
Combined CI `34855313462`: SUCCESS both required jobs.
BR-06 is not reopened by the CORE-05 review remediation.

## CORE-05

Owner / implementer: `@wbdevworld` / WS3.
Required base: `BR06_INTEGRATION_SHA` above.
Accepted pre-review-remediation source: `5c5c93f523ac9a5218cc916a8a6b6503cca4df75`; import merge `53b3982772b35886b3ac0fa0d50e374e9e359752`.

Ben's independent review on exact R5 head `f0ddc31f1ee1d9cd69768049ec33da839ab8185a` requested one change: an existing verified payment could be reused under a fresh Idempotency-Key before validating the new cash command's currency/amount/evidence.

Narrow owner fix:
- source commit/head `80414c6396832b9f9ec209cdec6e73ab19cd160a`;
- changed only `confirm-cash.ts` and a focused existing-payment regression test;
- source CI `34870285209`: SUCCESS Linux + Windows, including reset/pgTAP, app tests, build and E2E;
- source handoff: FRESH_2;
- integration merge `bc14b1e860a992ba432ff752f3ab15e4ad5c1001`;
- combined CI `34870882712`: SUCCESS both required jobs.

Accepted behavior after remediation: validate sale/org/location/economic invariants before existing-payment reuse; fresh-key reuse requires matching recorded `saleId`, amount and exact `cashReceived`; wrong currency, underpayment and materially different cash received are rejected; exact matching evidence reuses the same payment without a second `cash_sale` ledger effect. Existing same-key replay and persistence repair remain intact.

Contracts v1.0.0 unchanged. ADRs unchanged. Issue #4 OPEN. `pricingParityVerified=false`. No production promotion. BR-07 remains R6 real commercial finalizer; R6 is NOT STARTED.

Next exact action: this integration-control commit becomes the replacement frozen R5 review candidate. Require CI on that exact head, perform exactly two final freshness observations, then re-request `@Ben-001-sys`. No Pass 3 and no self-approval.
