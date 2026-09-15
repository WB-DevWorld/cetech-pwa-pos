# R6-REM-02 authority — final review security/correctness remediation

Kind: AUTHORITY_CHECKPOINT (ADR-014 temporary review-remediation lease)
UTC: 2026-09-15T11:10:00Z
Editor: `@wbdevworld` / WS3
Neutral branch: `batch/r6-first-real-cash-sale`
Exact reviewed head this lease is recorded against: `f6f57cc39b77dd576734a5b8fb5f89be3027c44c`
Base main: `bc606a690f0c167b7057e3ae9143337404275882`
PR: #55 (draft; REQUEST_CHANGES from Ben and Emmanuel; not review-ready)

This lease does **not** rewrite R6-REM-01 history. It does not authorize a second training commercial sale. Woo order `49439` remains historical staging evidence.

## Review provenance

Independent final review of PR #55 on `f6f57cc…`:

- Ben (`@Ben-001-sys`): **REQUEST_CHANGES** — incomplete transaction tenant/scope isolation; existing or remotely recovered state can be returned from a client-supplied `transactionId` before proving staff scope.
- Emmanuel (`@Emmanuel-coder-prog`): **REQUEST_CHANGES**
  - Blocker 1: `finalizeSale()` treats `commercial.ok === true` as commercial confirmation, including `SaleResolution.status === "requires_attention"`.
  - Blocker 2: insufficient-cash validation can consume the durable cash command identity so a corrected amount on the same FE-05 key becomes `IDEMPOTENCY_CONFLICT`.

## Owners

| Role | Human | Workstream |
| --- | --- | --- |
| Original R6 / CORE-06 owner | `@wbdevworld` | WS3 — Core / data / integration |
| Remediation / implementing owner | `@wbdevworld` | WS3 — Core / data / integration |

Ownership is not transferred across humans or workstreams. This is not a WS1 or WS2 takeover.

## Task

`R6-REM-02 — final review security/correctness remediation`

Reason: close Ben/Emmanuel final-review blockers with automated proof. Do not repeat the training cash sale.

## Authorized paths (temporary; use only when necessary)

```text
CURRENT-WORK.md
apps/pos-web/src/core/checkout/**
apps/pos-web/src/server/auth/**
apps/pos-web/src/server/sales/**
apps/pos-web/src/server/http/**
apps/pos-web/src/app/api/**
apps/pos-web/src/config/**
supabase/migrations/**
supabase/tests/**
tests/integration/**
tests/contracts/**
tests/e2e/**
tests/tooling/**
docs/integration/evidence/**
docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md
docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md
```

## Forbidden

WS1 `apps/pos-web/src/features/**` and `apps/pos-web/src/ui/**`.
WS2 `wordpress/cetech-pos-bridge/**` and `tests/bridge/**` as implementation source.
Frozen v1 contracts unchanged unless an unavoidable blocker follows the contract-change process.
No second training commercial sale.

## Expiry

Expires when (1) R6-REM-02 is imported/tested and the replacement candidate frozen, or (2) PR #55 is closed/merged, whichever happens first.

## Provenance after this checkpoint

```text
reviewed head f6f57cc…
→ this authority checkpoint
→ WS3 branch ws3/r6-rem-02-final-review-security
→ tested source
→ import onto batch/r6-first-real-cash-sale
→ combined candidate
```
