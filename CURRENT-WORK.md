# Current work ledger

Updated 2026-09-15. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `bc606a690f0c167b7057e3ae9143337404275882` — R5 PR #53 merge; protected.
- ADR-012 and ADR-014 are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Neutral R6 reviewed head was `f6f57cc39b77dd576734a5b8fb5f89be3027c44c`. R6-REM-02 imported onto `batch/r6-first-real-cash-sale`. PR #55 remains **draft**. Do not merge.

## Temporary R6-REM-02 lease (ADR-014) — not retroactive to R6-REM-01

Ben and Emmanuel REQUEST_CHANGES on `f6f57cc…`. This lease does **not** rewrite R6-REM-01 history and does **not** grant a second training commercial sale. Order `49439` remains historical evidence.

| Field | Value |
| --- | --- |
| Task | `R6-REM-02 — final review security/correctness remediation` |
| Original owner | `@wbdevworld` / WS3 |
| Remediation owner | `@wbdevworld` / WS3 (same human/workstream; scope expansion, not a transfer) |
| Evidence | `docs/integration/evidence/R6-REM-02-AUTHORITY.md`, `R6-REM-02-SOURCE.md`, `R6-REM-02-IMPORT.md` |
| Expiry | when R6-REM-02 is imported/tested and the replacement candidate frozen, **or** PR #55 closed/merged, whichever first |

| Role | SHA |
| --- | --- |
| Reviewed head | `f6f57cc39b77dd576734a5b8fb5f89be3027c44c` |
| Authority checkpoint | `922720ccbc9e12c535c765c44f1dfea887b19ccc` |
| Remediation source | `edafe1e64c869528f57eb8e4bba8b317b33a46c4` |
| Imported (cherry-pick -x) | `82a85f4082f461a2709ccfece9a73e4e8872d3d3` |

Authorized paths (use only when necessary): `CURRENT-WORK.md`; `apps/pos-web/src/core/checkout/**`; `apps/pos-web/src/server/auth/**`; `apps/pos-web/src/server/sales/**`; `apps/pos-web/src/server/http/**`; `apps/pos-web/src/app/api/**`; `apps/pos-web/src/config/**`; `supabase/migrations/**`; `supabase/tests/**`; `tests/integration/**`; `tests/contracts/**`; `tests/e2e/**`; `tests/tooling/**`; `docs/integration/evidence/**`; WS3 `STATUS.md`/`HANDOFF.md`.

Forbidden: WS1 `apps/pos-web/src/features/**` and `src/ui/**`. WS2 plugin/tests as source. Frozen v1 contracts unless an unavoidable blocker follows the contract process. No second training sale.

After this checkpoint: WS3 remediation branch `ws3/r6-rem-02-final-review-security` was created from the published authority SHA. Tested source `edafe1e…` was imported onto `batch/r6-first-real-cash-sale` as `82a85f4…`. Replacement FRESH_2 remains required on the frozen candidate.

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
| Remediation source (durable adapters) | `29f2da19311c8f7d9442aaa2ee0ab9f3b46ac254` |
| Imported (cherry-pick) | `3b30b29d3859539662be7896d3782667cc841732` |
| Timestamp-normalization source | `b95f4df06064af167770c6e36bb2c049412f7692` |
| Timestamp-normalization import | `c6a9318222f11c8b7a150c8bb558749fcf845f76` |

## Active assignment — R6 first real cash sale

- Integration issue: **#54**. Milestone PR: **#55** (draft). Neutral branch: `batch/r6-first-real-cash-sale`.
- FE-05 / BR-07: ACCEPTED / IMPORTED / VERIFIED. CORE-06: imported. R6-REM-01 durable runtime imported. Isolated training cash sale **PASS** (order `49439`; evidence `docs/integration/evidence/R6-TRAINING-REAL-SALE.md`).
- Production / Paystack / MoMo / card / returns / R7 remain unauthorized. Do not merge PR #55 from this lease.

```text
CODE / CONTRACT / AUTOMATED COMBINED GATE: PASS (R6-REM-02 imported; replacement FRESH_2 pending)
DURABLE POS RUNTIME GATE: PASS
ISOLATED STAGING REAL-SALE GATE: PASS (order 49439 retained; no second sale)
R6 FINAL REVIEW REMEDIATION: IMPORTED / COMBINED GATE PASS (R6-REM-02)
BEN BLOCKER: RESOLVED (durable prepare-scope binding)
EMMANUEL BLOCKER 1: RESOLVED (completed-only commercial confirmation)
EMMANUEL BLOCKER 2: RESOLVED (pre-effect cash validation)
FE-05 SOURCE: UNCHANGED
BR-07 SOURCE: UNCHANGED
```
