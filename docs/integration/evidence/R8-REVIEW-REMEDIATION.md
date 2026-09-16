# R8-01 Ben exact-head review remediation

Date: 2026-09-16. Integration editor: `@wbdevworld` / WS3. Mode: INTEGRATE / REMEDIATE. No secrets.

This is not a redesign. This is not R9. This is not permission to merge PR #69. Ben's `CHANGES_REQUESTED` on the prior exact head is not dismissed.

## Refs

| Role | SHA / id |
| --- | --- |
| Protected `origin/main` at start | `1feb78db36f33e0254c0170396f30112d71577ea` |
| `origin/main` after fetch (did not move) | `1feb78db36f33e0254c0170396f30112d71577ea` |
| Prior exact R8 head Ben reviewed | `b6403c5d0df2d6d82d42eba41100b34aa3242cef` |
| Prior exact-head CI | `35143511686` SUCCESS, then Ben `CHANGES_REQUESTED` |
| Recovery branch | `batch/r8-safe-returns-reconciliation` |
| Milestone PR | **#69** draft — not merged, not self-approved |

Replacement SHA cannot be self-referential in this file. See `git rev-parse HEAD` after the remediation commit and the Cursor report.

## Ben's three verified blockers

All three were genuine. Isolated WS3 and WS2 suites had passed on `b6403c5…` because WS3 used a fake bridge and WS2 used hand-built valid payloads.

### Blocker 1 — `economicsVersion` mismatch

WS3 derived `economicsVersion` as a SHA-256 of historic return economics. WS2 requires `economicsVersion === prepared.quoteFingerprint`. A real WS3-generated bridge command could be rejected.

**Resolution:** `economicsVersion` is the already-durable `PreparedSale.quoteFingerprint`. It is a shared version/binding token, not permission to price refunds from current catalog quotes. Refund math still uses `allocateHistoricMinor` against original sold quantity, historical subtotal/discount/tax/total, verified original tender, already-returned quantity, and already-refunded amount.

Removed competing `economicsVersionFor()` SHA helper. Preview, persisted `StoredReturnRecord`, commercial-refund command, stock-disposition command, and return fingerprint all bind the same token. Changed economics under an already-used effect identity still fail closed. Frozen v1 wire shape unchanged.

### Blocker 2 — partial return line allocation

Preview computed `lineRefund` via `allocateHistoricMinor`, but execute sent `historicAmount: historic.historicalTotal` (full line). WS2 correctly rejects `sum(lineAllocations.historicAmount) !== command.amount`.

**Resolution:** persist exact preview allocation as internal `StoredRequestedReturnLine.allocatedHistoricAmount`. Survive in-memory clone, Supabase JSON/columns (`allocated_historic_amount_minor` / `allocated_historic_currency`), and reload. `buildCommercialRefundCommand` copies that persisted amount. Additive migration `20260916220000_pos_return_line_allocations.sql`. No new monetary arithmetic.

Odd-minor regression (3001): first partial 1500, second 1501, sum 3001, each command allocation equals that command amount, third quantity rejected, no over-refund.

### Blocker 3 — Returns/Register not composed

`PosApp` only mounted Sell. Frozen return BFF routes were absent.

**Resolution:** canonical BFF routes only:

- `POST /api/pos/v1/returns/preview`
- `POST /api/pos/v1/returns/execute`
- `GET /api/pos/v1/returns/{returnId}`
- plus already-frozen register/close: `GET /registers/{id}`, `GET /registers/{id}/active-shift`, `POST /shifts/close`, `GET /shifts/{id}/report`

Route handlers call existing WS3 handlers. Browser `ReturnPort` / `RegisterPort` use those routes. `route === "returns"` mounts accepted FE-06 Returns; `route === "register"` mounts accepted FE-06 Register. Counted cash is staff input; expected cash and variance are server-owned. No R9 operational-close work.

## Cross-layer harness

`executeReturn()` uses `buildCommercialRefundCommand` / `buildStockDispositionCommand`. PHP creates a completed qty-2 sale, writes meta, spawns `apps/pos-web/scripts/run-ws3-return-commands.mjs` (Vite SSR loads the same TypeScript generators), then feeds the unmodified JSON into WS2 schema validation and the commercial-refund / stock-disposition producers. Replay uses the same Idempotency-Key. Third over-quantity and wrong `economicsVersion` fail closed.

Vitest also writes `tests/bridge/fixtures/ws3-generated/*` from the same builders so a handwritten fixture cannot silently replace the generator.

## Targeted local evidence (this workstation)

| Case | Result |
| --- | --- |
| preview `economicsVersion` = `quoteFingerprint` | PASS |
| historic totals remain on `historicLines`; allocation is the preview `lineRefund` | PASS |
| in-memory persist/reload of `allocatedHistoricAmount` | PASS |
| fake-posgrest/Supabase serialize/reload | PASS |
| first partial 1500 of 3000/3001 | PASS |
| second partial remainder 1501 of 3001 | PASS |
| cumulative cap; third quantity rejected | PASS |
| WS3 builder → WS2 producer (unmodified JSON) | PASS (PHP suite) |
| stock disposition same economicsVersion; damaged/quarantine/not-physical never restock sellable | PASS |
| Return BFF route modules exist | PASS |
| `/returns` and `/register` not R4 placeholder | PASS (unit + Playwright) |
| ReturnPort canonical routes + execute key reuse | PASS |
| RegisterPort counted-cash only | PASS |

## Full local gates

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `python -m unittest discover -s tests/tooling -v` | 48 OK |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | 69 files / 653 tests PASS |
| `pnpm --dir apps/pos-web build` | PASS; return/register routes present |
| `pnpm --dir apps/pos-web test:e2e` | 9 passed (Sell cash + `/returns` + `/register`) |
| `git diff --check` | clean |
| Docker apply `20260916220000_pos_return_line_allocations.sql` then pgTAP | `pos_returns.sql` 41/41; `payment_monotonic.sql` 6/6; `electronic_payment.sql` 16/16; all ROLLBACK |
| `C:\tools\php85\php.exe tests/bridge/run.php` | **1555 passed, 0 failed** |
| `C:\tools\php85\php.exe tests/bridge/parity.php` | 138 passed, 0 failed, 19 skipped (live/training) |
| WSL `make -C wordpress/cetech-pos-bridge check PHP=/mnt/c/tools/php85/php.exe` | PASS |
| `.next/static` secret scan (`sk_live_`, `PAYSTACK_SECRET`, `NEXT_PUBLIC_PAYSTACK`) | no matches |

First Playwright attempt failed 3 tests because `page.goto /sell` raced the webServer build. Retry after the production server was up: 9/9 PASS. Not reported as PASS on the failed attempt.

## R7 preservation

Electronic-payment unit/integration suite remains in the 653. `sk_live_` still refused. Callback is not payment authority. Monotonic pgTAP 6/6. Cash sale E2E still green. CD-01 files not edited.

## Non-effects

- No real Paystack charge or refund
- No real Woo refund or stock restock
- No production deploy
- No VitePOS deactivation
- No merge of PR #69
- No dismiss of Ben's review
- No R9 import (`CORE-07`, `FE-07`, Store Health, SW lifecycle, R9 Z-report)

## Freshness / CI

Exact-head GitHub CI and ADR-012 Pass 1 + Pass 2 are recorded after push in the Cursor report. Do not reuse CI `35143511686` as evidence for the replacement SHA.
