# R6 activation — first real cash sale vertical slice

Date: 2026-09-14 UTC
Integration issue: #54
Neutral branch: `batch/r6-first-real-cash-sale`
Integration editor: `@wbdevworld` / WS3
Activation baseline: `main` `bc606a690f0c167b7057e3ae9143337404275882`
R5 post-merge CI: `34873987182` SUCCESS on Linux + Windows

## R5 closure

R5 PR #53 was independently approved by `@Ben-001-sys` on exact head `73f16621b32de0fc04aceffb3af63d9227fec31d` and merged to `main` as `bc606a690f0c167b7057e3ae9143337404275882`. Issues #24 and #52 are closed completed. BR-06 / #18 was already closed completed. R5 is therefore APPROVED / MERGED / POST-MERGE VERIFIED.

Issue #4 remains OPEN. `pricingParityVerified=false`. No production promotion is authorized by R5 or this R6 activation.

## Parallel R6 starts

### BR-07 / #19 — WS2
Owner: `@Emmanuel-coder-prog`
Branch: `ws2/br-07-implement-verified-commercial-finalization-an`
Base: exact R5 merge `bc606a690f0c167b7057e3ae9143337404275882`
State: ACTIVE — OWNER IMPLEMENTATION

BR-07 owns verified commercial finalization/cancel inside the Woo bridge. Duplicate finalization must not duplicate stock effect; uncertain money must block unsafe release/cancel; late success must enter attention/reconciliation behavior. Frozen v1.0.0 `BridgeFinalizeRequest` / `SaleResolution` remain authoritative unless a separate contract-change decision is recorded.

### FE-05 / #10 — WS1
Owner: `@Ben-001-sys`
Branch: `ws1/fe-05-integrate-cash-checkout-and-receipt-ux`
Base: exact R5 merge `bc606a690f0c167b7057e3ae9143337404275882`
State: ACTIVE — OWNER IMPLEMENTATION

FE-05 owns cashier cash-checkout/receipt UX only. It must render prepare/resolve/cash/finalizing/complete truthfully, preserve draft on failures, and ensure failed print/reprint handling does not repeat the sale. Browser/UI state is not payment authority.

## WS3 integration gate

WS3 does not implement BR-07 or FE-05. Each owner publishes exact tested source SHA(s) and stops. WS3 then independently reviews/imports accepted contributions into the neutral branch and runs combined verification.

CORE-06 / #25 is BLOCKED. Its branch must not be created until both BR-07 and FE-05 are accepted, imported, and combined-tested and WS3 publishes the exact tested R6 integration handoff SHA. CORE-06 must start from that SHA, not from `main`.

## Final R6 gate

After CORE-06 is imported: full combined checks, exact final-head CI, exactly two ADR-012 freshness observations, no Pass 3, and independent competent-human review before merge.
