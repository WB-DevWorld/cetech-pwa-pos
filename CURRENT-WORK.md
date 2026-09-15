# Current work ledger

Updated 2026-09-15. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `bc606a690f0c167b7057e3ae9143337404275882` — R5 PR #53 merge; protected.
- R5 post-merge CI `34873987182`: SUCCESS on both required jobs.
- ADR-012 and ADR-014 are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Explicit implementation reassignments: **NONE**.
- Explicit R6 training order/stock/tender-write authorization: **NOT GRANTED**.

## Active assignment — R6 first real cash sale

- Integration issue: **#54 R6-00**.
- Milestone PR: **#55** — `[R6] First real cash sale vertical slice` (**draft**; not review-ready).
- Neutral branch: `batch/r6-first-real-cash-sale`.
- Integration editor: `@wbdevworld` / WS3.
- Activation baseline: `main` `bc606a690f0c167b7057e3ae9143337404275882`.
- Tested combined pre-CORE06 handoff: **`R6_INTEGRATION_SHA=ef7660ddca607ca748cb9eb71487b856004d0817`**.
- CORE-06 imported **tested combined implementation** SHA: **`e64b0fa94bddb40ccf2e13b3ffb289a995b49c92`**.
- Milestone state: **R6 BLOCKED — isolated staging real-sale gate (`BLOCKED_RUNTIME_EVIDENCE`)**.
- Staging preflight: **`READY_FOR_OPERATOR_AUTHORIZATION`**. Plan: `docs/runbooks/R6-STAGING-CASH-SALE-REHEARSAL.md`. Chronology: `docs/integration/evidence/R6-CP04-CHRONOLOGY.md`.

### R6 contributions

| Task | Owner | Source / integration | State |
| --- | --- | --- | --- |
| FE-05 / #10 | `@Ben-001-sys` / WS1 | source `79708d67b655eb46f8aba77712a83508e095f758`; import `8dabbde2af91b3aa31f00ae159b5f8cd7a3280a9`; CI `34890381897` | **ACCEPTED / IMPORTED / VERIFIED** |
| BR-07 / #19 | `@Emmanuel-coder-prog` / WS2 | source `fe97acfe0b5530d7eb861ccc0a9aea391e3daca3`; import `2ef938c4f9e89e50537804e2511ac9b7e0b596da`; combined handoff `ef7660dd…`; CI `34908900786` | **ACCEPTED / IMPORTED / VERIFIED** |
| CORE-06 / #25 | `@wbdevworld` / WS3 | source `9e7bae589ccd8df818ded67d59dca37683837204`; implementation `0162e408d10e22eb9806aa5c5d61ca74a91a2192`; import `212374d8…` + `e64b0fa9…`; combined CI `34919556401` | **IMPORTED / AUTOMATED COMBINED GATE PASS / STAGING REAL-SALE BLOCKED** |

CORE-06 automated/in-process/Playwright proof is green on the imported tree. Instrumented `woo-1` is not a live training order.

### CP-04 relative to this R6 sale (do not flatten history)

- CP04-W1: **HISTORICAL PASS** 2026-09-13 (`af7e2a268229b2fe4cf6a3df495dc030646328ac` on `ws3/cp-04-r2-runtime-gates`; accepted in merged PR #43). **CURRENT_PASS** freshness 2026-09-15 (MU intercept present; MailPoet inactive; notify domains `training.invalid`; webhooks 0; mailq empty).
- CP04-W2: **PASS as resource/write-boundary map**. Order/stock/payment writes: **NO**. That map does not authorize this sale.
- CP04-W4: **HISTORICAL PASS** WordPress identity/health 2026-09-13 (`67ea42ce03142fb9f0ca18446b8146b0815ea621` / head `edf24afaf7d57d6109a761820f5cfb8bc548973f`; consumed in `R2-CP04-W4-CONSUMED.md`). **CURRENT_PASS** identity/health 2026-09-15 (anonymous 401; authenticated 200 healthy; user 22 still least privilege). Training plugin is still **`0.2.7-br02`**; BR-07 prepare/finalize routes are **DRIFTED** vs R6 `0.4.0-br07`.

W1/W4 historical grants are not R6 sale grants. Do not recreate the service user or Application Password.

## R6 remaining gate

```text
CODE / CONTRACT / AUTOMATED COMBINED GATE: PASS
ISOLATED STAGING REAL-SALE GATE: BLOCKED
R6 FINAL ACCEPTANCE: BLOCKED_RUNTIME_EVIDENCE
R6_STAGING_PREFLIGHT = READY_FOR_OPERATOR_AUTHORIZATION
R6_STAGING_WRITE_AUTHORIZATION = NOT_GRANTED
```

Next: operator explicit authorization for (1) training install of exact R6 `0.4.0-br07` if routes remain absent, then (2) one synthetic cash-sale rehearsal on `49111` qty 1. Re-verify containment immediately before execution. Do not start R7. Do not merge PR #55.

No R7+, returns/refunds, electronic payment-provider execution, or production promotion is authorized by this R6 session.
