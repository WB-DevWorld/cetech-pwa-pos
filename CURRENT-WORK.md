# Current work ledger

Updated 2026-09-15. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `bc606a690f0c167b7057e3ae9143337404275882` — R5 PR #53 merge; protected.
- ADR-012 and ADR-014 are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Neutral R6 head this lease is recorded against: `eac32cdff60f0f6ed80bb0908f9091543c859ead`.

## Temporary R6-REM-01 lease (ADR-014) — not retroactive

Ben checkpoint review (`@Ben-001-sys`) on `eac32cd…`: **COMMENTED**, not approval. Finding A: CORE-06 `0162e408…` exceeded issue #25 declared paths. Finding B: ephemeral checkout store + empty memory assignment directory.

This lease does **not** claim those original CORE-06 path edits were authorized. Issue #25 allowed-files text is not rewritten.

| Field | Value |
| --- | --- |
| Task | `R6-REM-01 — CORE-06 scope reconciliation and durable staging runtime` |
| Original owner | `@wbdevworld` / WS3 |
| Remediation owner | `@wbdevworld` / WS3 (same human/workstream; scope expansion, not a transfer) |
| Evidence | `docs/integration/evidence/R6-REM-01-AUTHORITY.md` |
| Expiry | when R6 remediation is imported/tested and the final candidate frozen, **or** PR #55 closed/merged, whichever first |

Authorized paths (use only when necessary): `CURRENT-WORK.md`; `apps/pos-web/src/core/checkout/**`; `apps/pos-web/src/server/auth/**`; `apps/pos-web/src/server/sales/**`; `apps/pos-web/src/server/http/**`; `apps/pos-web/src/config/**`; `apps/pos-web/src/app/**`; `apps/pos-web/vitest.config.mts`; `supabase/migrations/**`; `supabase/seed.sql`; `supabase/tests/**`; `tests/integration/**`; `tests/contracts/**`; `tests/e2e/**`; `tests/tooling/**`; `docs/integration/evidence/**`; `docs/runbooks/**`; WS3 `STATUS.md`/`HANDOFF.md`; `.github/workflows/**` only if required to register tests.

Forbidden: WS1 `apps/pos-web/src/features/**` and `src/ui/**`. WS2 plugin/tests as source. Frozen v1 contracts unless an unavoidable blocker follows the contract process.

After this checkpoint: WS3 remediation branch `ws3/r6-rem-01-durable-runtime` from the published authority SHA. Durable assignment + checkout adapters were implemented and imported onto `batch/r6-first-real-cash-sale`.

| Role | SHA |
| --- | --- |
| Authority checkpoint | `f547542ca23efaf61243909c320d7dd900709188` |
| Remediation source | `29f2da19311c8f7d9442aaa2ee0ab9f3b46ac254` |
| Imported (cherry-pick) | `3b30b29d3859539662be7896d3782667cc841732` |
| Tested combined | `3b30b29d3859539662be7896d3782667cc841732` |

## Active assignment — R6 first real cash sale

- Integration issue: **#54**. Milestone PR: **#55** (draft). Neutral branch: `batch/r6-first-real-cash-sale`.
- FE-05 / BR-07: ACCEPTED / IMPORTED / VERIFIED. CORE-06: imported; automated combined gate PASS; **durable runtime and isolated staging sale still required**.
- Bounded training sale (SKU `49111` qty 1, plus BR-07 `0.4.0-br07` deploy if needed) is **authorized by the R6-REM-01 prompt** for training only. It must not run until durable assignment + checkout adapters exist. Production / Paystack / MoMo / card / returns / R7 remain unauthorized.

```text
CODE / CONTRACT / AUTOMATED COMBINED GATE: PASS
DURABLE POS RUNTIME GATE: PASS (imported; training sale pending)
ISOLATED STAGING REAL-SALE GATE: BLOCKED (await BR-07 deploy + sale)
```
