# WS3 current handoff — R5 assembled for final review gate

Kind: INTEGRATION_CHECKPOINT. Date: 2026-09-14 UTC.

Task / batch / workstream: R5 / issue #52 integration; BR-06 #18 + CORE-05 #24; WS3 integration editor.
Owner / integration editor: `@wbdevworld` / WS3.
Branch / PR: `batch/r5-idempotent-prepare-cash` / PR #53.
Base main: `da86434cc471703b8309cea77cda88b7845c299b`.

## BR-06 provenance

Owner / implementer: `@Emmanuel-coder-prog` / WS2.
Accepted source head: `a0fa00d452c3a672d97c5a3cb253a5ca6f11cf8f`.
Integration merge: `30af336925fd29dc43e7315d81919ae2a7bd5bfc`.
Published tested handoff: `BR06_INTEGRATION_SHA=15baab1b47a35902b8a3ddde989df55cc4b25436`.
Combined CI: `34855313462` SUCCESS on `control-plane` + `control-plane-windows`.
Source bridge evidence: 1020 passed / 0 failed; parity 138 / 0 / 19 permission-required-skipped. Live HPOS / real DB concurrency evidence remains PENDING and is not claimed.

## CORE-05 provenance

Owner / implementer: `@wbdevworld` / WS3.
Required base: exact `BR06_INTEGRATION_SHA` above.
Rejected prior source: `602a47457cc69298cec06dbed2e99c4dc4cf8255` / `def73afd35edb4ea099d59a8c8351a0f2ab7081d`.
Accepted replacement implementation: `7226b686982b3da8746526aa8f60744a8b53ab25`.
Accepted final contributor head: `5c5c93f523ac9a5218cc916a8a6b6503cca4df75`.
Import merge: `53b3982772b35886b3ac0fa0d50e374e9e359752`.
Combined CI on that import: `34867174407` SUCCESS on both required jobs, including Supabase reset/pgTAP, lint, typecheck, unit tests, build and E2E smoke.

CORE-05 source-head CI `34865309195` also succeeded on Linux + Windows. Source evidence: control-plane PASS; lint/typecheck PASS; Vitest 46 files / 326 tests PASS; official Supabase CLI 2.117.0 reset PASS; pgTAP Files=2 / Tests=88 PASS. The Windows `npx` reset launcher failure is documented as a host-specific `npx.cmd` restriction and was not mislabeled PASS.

Closed review blockers:
1. CORE-02 `authorizeStaffMutation` / `authorizeStaffRead` assignment authority is used; mutation permissions are `shift.open`, `payment.cash`, `sale.finalize`; receipt read is assignment-scoped without inventing a new permission.
2. Cash-ledger→POS persistence and commercial-finalizer→POS persistence failures enter `requires_attention` repair; retry uses the same intent/key and does not create a second cash ledger effect or second commercial sale in the authorized mock boundary.
3. `pos_cash_one_sale_per_transaction` migration is reset/pgTAP validated.
4. Contributor reverted the out-of-scope Vitest config change; the harness is discovered under `src/server/sales/**`.

Contracts: v1.0.0 unchanged. ADRs: unchanged. New migration: `20260914150000_pos_cash_sale_one_per_transaction.sql`.

Runtime limitations: BR-07 is still required for the real commercial finalizer; CORE-05 uses the explicitly permitted mock. Durable production checkout/assignment adapters remain unavailable and staging/production composition fails closed. No production promotion, payment-provider execution, or R6 implementation is claimed.

Issue #4 remains OPEN. `pricingParityVerified=false`.

Next exact action: this integration-control commit becomes the frozen R5 review candidate. Require CI on that exact head, perform exactly two final ADR-012 freshness observations, then request independent human review. No Pass 3. Do not self-approve or merge before approval.
