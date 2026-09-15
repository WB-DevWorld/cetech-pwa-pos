# Current work ledger

Updated 2026-09-15. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Current authority

- `main`: `bc606a690f0c167b7057e3ae9143337404275882` — R5 PR #53 merge; protected.
- R5 post-merge CI `34873987182`: SUCCESS on both required jobs.
- ADR-012 and ADR-014 are active; ownership-preserving milestone execution remains required.
- Issue #4 remains **OPEN**. `pricingParityVerified=false`. Production promotion is not authorized.
- Explicit implementation reassignments: **NONE**.

## Active assignment — R6 first real cash sale

- Integration issue: **#54 R6-00**.
- Milestone PR: **#55** — `[R6] First real cash sale vertical slice` (**draft**; not review-ready).
- Neutral branch: `batch/r6-first-real-cash-sale`.
- Integration editor: `@wbdevworld` / WS3.
- Activation baseline: `main` `bc606a690f0c167b7057e3ae9143337404275882`.
- Tested combined pre-CORE06 handoff: **`R6_INTEGRATION_SHA=ef7660ddca607ca748cb9eb71487b856004d0817`**.
- CORE-06 imported **tested combined implementation** SHA: **`e64b0fa94bddb40ccf2e13b3ffb289a995b49c92`** (GitHub Actions `34919556401` / `34919562334` SUCCESS). A later scheduler/docs commit on this branch records the runtime-gate classification and does not change implementation.
- Milestone state: **R6 BLOCKED — isolated staging real-sale gate (`BLOCKED_RUNTIME_EVIDENCE`)**.

### R6 contributions

| Task | Owner | Source / integration | State |
| --- | --- | --- | --- |
| FE-05 / #10 | `@Ben-001-sys` / WS1 | source `79708d67b655eb46f8aba77712a83508e095f758`; import `8dabbde2af91b3aa31f00ae159b5f8cd7a3280a9`; CI `34890381897` | **ACCEPTED / IMPORTED / VERIFIED** |
| BR-07 / #19 | `@Emmanuel-coder-prog` / WS2 | source `fe97acfe0b5530d7eb861ccc0a9aea391e3daca3`; import `2ef938c4f9e89e50537804e2511ac9b7e0b596da`; combined handoff `ef7660dd…`; CI `34908900786` | **ACCEPTED / IMPORTED / VERIFIED** |
| CORE-06 / #25 | `@wbdevworld` / WS3 | source `9e7bae589ccd8df818ded67d59dca37683837204`; implementation `0162e408d10e22eb9806aa5c5d61ca74a91a2192`; import `212374d8…` + `e64b0fa9…`; combined CI `34919556401` | **IMPORTED / AUTOMATED COMBINED GATE PASS / STAGING REAL-SALE BLOCKED** |

FE-05 retains prepared-sale lockout, stable cash attempt identity, payment resolution instead of duplicate tender, ReceiptPort truth and print isolation.

BR-07 retains durable finalize/cancel command claims, exact prepared-sale/payment/economic binding, one commercial payment/stock effect, and fail-closed cancellation when money is unresolved. Live HPOS finalize/cancel rehearsal and real DB concurrency remain pending evidence and are not claimed.

CORE-06 automated/in-process/Playwright proof is green on the imported tree. That is **not** isolated staging Woo acceptance. Instrumented `woo-1` is not a live training order.

## R6 remaining gate

```text
CODE / CONTRACT / AUTOMATED COMBINED GATE: PASS
ISOLATED STAGING REAL-SALE GATE: BLOCKED
R6 FINAL ACCEPTANCE: BLOCKED_RUNTIME_EVIDENCE
```

Training `GET /wp-json/cetech-pos/v1/health` now returns authenticated-required JSON (401 `AUTH_REQUIRED`); the plugin route exists. CP-04 write-safety remains OPEN: isolation not proven, MailPoet/email previously UNSAFE, no recorded authorization for order/stock/tender writes. Do not invent a live sale.

Do not start R7. Do not merge PR #55. Do not self-approve. Do not run ADR-012 final FRESH_2 as if R6 acceptance were complete. Preserve this green combined candidate until the staging gate is explicitly authorized and executed.

No R7+, returns/refunds, electronic payment-provider execution, or production promotion is authorized by this R6 session.
