# R6-REM-01 authority — CORE-06 scope reconciliation and durable staging runtime

Kind: AUTHORITY_CHECKPOINT (ADR-014 temporary scope expansion / review-remediation lease)
UTC: 2026-09-15T08:10:00Z
Editor: `@wbdevworld` / WS3
Neutral branch: `batch/r6-first-real-cash-sale`
Exact head this lease is recorded against: `eac32cdff60f0f6ed80bb0908f9091543c859ead`
PR: #55 (draft; not review-ready)

This authority is **not retroactive**. It does not claim that original CORE-06 / issue #25 allowed the out-of-scope files. Issue #25's original allowed-files text is not edited.

## Ben review provenance

Independent checkpoint review by `@Ben-001-sys` on exact head `eac32cdff60f0f6ed80bb0908f9091543c859ead`: **COMMENTED**, not approval.

- Finding A: CORE-06 implementation `0162e408d10e22eb9806aa5c5d61ca74a91a2192` exceeded issue #25 declared paths.
- Finding B: runtime still uses ephemeral checkout store and empty memory assignment directory; staging/production fail closed. Installing BR-07 alone cannot prove the required durable topology.

## Owners

| Role | Human | Workstream |
| --- | --- | --- |
| Original CORE-06 owner | `@wbdevworld` | WS3 — Core / data / integration |
| Remediation / implementing owner | `@wbdevworld` | WS3 — Core / data / integration |

Ownership is not transferred across humans or workstreams.

## Task

`R6-REM-01 — CORE-06 scope reconciliation and durable staging runtime`

Reason: resolve Ben's R6 checkpoint findings so the already-built R6 sale can run through a durable POS runtime and meet issue #25 real-sale acceptance.

## Authorized paths (temporary; use only when necessary)

```text
CURRENT-WORK.md
apps/pos-web/src/core/checkout/**
apps/pos-web/src/server/auth/**
apps/pos-web/src/server/sales/**
apps/pos-web/src/server/http/**
apps/pos-web/src/config/**
apps/pos-web/src/app/**
apps/pos-web/vitest.config.mts
supabase/migrations/**
supabase/seed.sql
supabase/tests/**
tests/integration/**
tests/contracts/**
tests/e2e/**
tests/tooling/**
docs/integration/evidence/**
docs/runbooks/**
docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md
docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md
.github/workflows/**
```

`.github/workflows/**` only if required to register or correctly execute maintained tests.

## Forbidden

WS1 `apps/pos-web/src/features/**` and `apps/pos-web/src/ui/**`.
WS2 `wordpress/cetech-pos-bridge/**` and `tests/bridge/**` as implementation source (training deploy of the already accepted BR-07 artifact is separately authorized later).
Frozen v1 contracts unchanged unless an unavoidable blocker follows the contract-change process.

## Expiry

Expires when (1) R6 remediation is imported/tested and the final R6 candidate is frozen, or (2) PR #55 is closed/merged, whichever happens first.

## Original issue #25 allowed files (historical; unchanged)

```text
tests/integration/**
tests/contracts/**
tests/e2e/**
.github/workflows/**
apps/pos-web/src/app/**
docs/integration/evidence/**
```

## CORE-06 implementation files outside that original list

Diff `ef7660ddca607ca748cb9eb71487b856004d0817..0162e408d10e22eb9806aa5c5d61ca74a91a2192`.

| Path | Classification |
| --- | --- |
| `apps/pos-web/src/core/checkout/in-memory-store.ts` | STILL_REQUIRED_FOR_R6 (quote snapshot + checkout persistence API). Durable adapter will supplement; memory remains local/test. Original commit exceeded declared path scope. |
| `apps/pos-web/src/core/checkout/types.ts` | STILL_REQUIRED_FOR_R6 (CheckoutStore). Test-fault fields to be moved off the production interface under this lease. Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/quotes/handle-quote.ts` | STILL_REQUIRED_FOR_R6 (persist quote snapshots). Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/authorize-checkout.ts` | STILL_REQUIRED_FOR_R6. Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/compose-checkout-runtime.ts` | REPLACED_BY_DURABLE_REMEDIATION for staging/production composition. Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/compose-sales-bridge.ts` | STILL_REQUIRED_FOR_R6 (server-only BR-07 HTTP). Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/core-06-cash-sale-harness.test.ts` | TEST_ONLY. Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/handle-prepare-sale.ts` | STILL_REQUIRED_FOR_R6. Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/handle-resolve-payment.ts` | STILL_REQUIRED_FOR_R6. Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/handle-resolve-sale.ts` | STILL_REQUIRED_FOR_R6. Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/instrumented-bridge-sales-port.ts` | TEST_ONLY. Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/mock-sales-port.ts` | STILL_REQUIRED_FOR_R6 (local/dev). Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/prepare-sale.ts` | STILL_REQUIRED_FOR_R6. Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/resolve-sale.ts` | STILL_REQUIRED_FOR_R6. Original commit exceeded declared path scope. |
| `apps/pos-web/src/server/sales/schema.ts` | STILL_REQUIRED_FOR_R6. Original commit exceeded declared path scope. |
| `apps/pos-web/vitest.config.mts` | TEST_ONLY / STILL_REQUIRED_FOR_R6 (harness discovery). Original commit exceeded declared path scope. |
| `apps/pos-web/e2e/cash-sale.spec.ts` | TEST_ONLY (Playwright lives under the app package; original text listed `tests/e2e/**`). Original commit exceeded declared path scope. |
| `apps/pos-web/e2e/sell-runtime.spec.ts` | TEST_ONLY. Original commit exceeded declared path scope. |
| `tests/tooling/test_vitest_discovery.py` | TEST_ONLY. Original commit exceeded declared path scope. |

In-scope under original #25 (for completeness): `apps/pos-web/src/app/**`, `docs/integration/evidence/CORE-06-*.md`, `tests/contracts/producer-consumer.test.ts`, `tests/e2e/README.md`, `tests/integration/sales/core-06-cash-sale-harness.test.ts`.

Preserved out-of-scope implementation that is still required will be re-examined under this lease. That does **not** erase the original authorization violation.

## Staging sale authorization (separate; this prompt)

The senior/user also authorized the bounded training rehearsal already documented in `docs/runbooks/R6-STAGING-CASH-SALE-REHEARSAL.md`, including BR-07 `0.4.0-br07` deploy if still needed and exactly one synthetic cash sale. That grant is **not** usable until durable runtime exists. Production, electronic payments, returns, and R7 remain unauthorized.
