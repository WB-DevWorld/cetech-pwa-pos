# Lane B — Checkout / recovery result

## Scope freeze (start)

- Task: `PARALLEL-LANE-B-CHECKOUT`
- Branch: `ws3/lane-b-checkout-2026-10-07`
- Base SHA: `0e383d84f11573ca89d6533c8cb7c35d79d7b261`
- Worktree: `C:\Users\Jane\Desktop\Learning 2026\Cursor\cetech-pwa-pos-lane-b-checkout`
- Production effects: **NONE**
- Scope file: `docs/testing/parallel-completion-2026-10-07/scope-lane-b-checkout.json`

### Exact allowed paths

- `apps/pos-web/src/server/sales/**`
- `apps/pos-web/src/features/sell/**`
- `apps/pos-web/src/app/attention*/**`
- `apps/pos-web/src/local/operation-journal*`
- `tests/integration/sales/**`
- `tests/frontend/**`
- `docs/testing/parallel-completion-2026-10-07/**`
- `CURRENT-WORK.md`

### Forbidden

- state machine replacement
- blind retries
- weakening commercial guards
- `wordpress/**` (except proven POS-side adapter bug still inside allowlist; prefer POS paths)
- `supabase/migrations/**`
- production

---

## Tested SHA

- Start / tested application baseline: `0e383d84f11573ca89d6533c8cb7c35d79d7b261`
- Evidence / fixture commit: `7f384b435f81e8f324757caacfc294685c3b7edb`
- Final Lane B head after evidence pins: see branch tip (`git rev-parse ws3/lane-b-checkout-2026-10-07`); package body landed in `7f384b435f81e8f324757caacfc294685c3b7edb`
- POS commercial code fix SHAs: **none** (no allowlisted POS defect requiring a runtime patch)
- Bridge fix SHAs: **none** (`wordpress/**` out of allowlist)

## Connected / unit check outcomes

All commands from repo root after `pnpm install --frozen-lockfile`. Runner: Vitest 5.0.0 / Node v24.21.0.

### Batch 1 — cash / prepare / finalize / duplicate / response loss / timeout / hazard fixture

```text
pnpm --dir apps/pos-web exec vitest run \
  src/server/sales/core-06-cash-sale-harness.test.ts \
  src/server/sales/payment-reservation-expiry.test.ts \
  src/features/sell/runtime/prepare-recovery-client.test.ts \
  src/app/checkout-client-journal.test.ts \
  src/app/checkout-client-r9.test.ts \
  ../../tests/integration/sales/woo-global-order-count-concurrency.fixture.test.ts \
  ../../tests/integration/sales/r10-fail-closed-prepare-guards.test.ts \
  ../../tests/integration/sales/r10-fail-closed-cash-guards.test.ts \
  ../../tests/integration/sales/r10-fail-closed-finalize-guards.test.ts \
  ../../tests/integration/sales/cash-finalize-orchestration.test.ts \
  ../../tests/frontend/cash-checkout.test.ts \
  ../../tests/frontend/r9-system-status-recovery.test.ts
```

Result: **12 files / 95 tests PASS** (0 fail).

Coverage mapped to goals:

| Goal | Primary proof |
| --- | --- |
| Cash / prepare / finalize | `core-06-cash-sale-harness`, `cash-finalize-orchestration`, `cash-checkout`, R10 fail-closed suites |
| Duplicate Pay / cash / finalize | CORE-06 duplicate prepare/cash/finalize; cash-checkout controller |
| Response loss | CORE-06 lost prepare; `checkout-client-journal` response_unknown; FE lost BFF prepare |
| Server timeout / ambiguous | `cash-checkout` timeout → resolve not re-prepare; prepare-recovery `OPERATION_IN_PROGRESS` |
| Reload / remount + original identity | `prepare-recovery-client` remount; (batch 3) hook/identity remount |
| Unresolved evidence preserved | journal `response_unknown` / `requires_attention`; attention repair suite (batch 3) |

### Batch 2 — durable store / prepare recovery classification

```text
pnpm --dir apps/pos-web exec vitest run \
  src/local/journal-recovery-scope.test.ts \
  ../../tests/integration/sales/durable-checkout-store.test.ts \
  src/server/sales/prepare-recovery.test.ts \
  src/server/sales/handle-resolve-sale-r9.test.ts
```

Result: **4 files / 24 tests PASS** (0 fail).

### Batch 3 — remount identity / attention / journal persistence

```text
pnpm --dir apps/pos-web exec vitest run \
  src/features/sell/runtime/use-cash-checkout-hook.test.tsx \
  src/features/sell/runtime/checkout-attempt-identity.test.ts \
  src/app/attention-prepare-repair.test.ts \
  ../../tests/integration/sync/operation-journal.test.ts
```

Result: **4 files / 53 tests PASS** (0 fail).  
Note: `use-cash-checkout-hook` emits React `act(...)` stderr noise; tests still PASS.

**Lane B aggregate: 20 files / 172 tests PASS, 0 fail.**

## Attention / recovery inspection (read-only)

- Inspected `apps/pos-web/src/local/operation-journal.ts`: unresolved rows are listed via `listUnresolvedJournalRecords` / `pending()`; transitions mark `response_unknown` / `requires_attention` / `acknowledged` — no delete API for attention evidence.
- `prepare-recovery-client.test.ts` asserts `indexedDB.deleteDatabase` is **not** called on attention / finalizing / completed-without-receipt paths.
- `operation-journal.test.ts`: `response_unknown` and `requires_attention` remain after reload.
- Lane B made **no** deletions of attention, journal, or pending-operation records.

## Global Woo order-count concurrency hazard

### Production site

`wordpress/cetech-pos-bridge/includes/class-woo-runtime.php` `create_prepared_order()`:

1. `$before = count_orders()` → global `SELECT COUNT(*) FROM {prefix}wc_orders`
2. Creates the POS order / reserves / describes
3. `$after = count_orders()`
4. If `($after - $before) !== 1` → `INTEGRATION_UNAVAILABLE` (“Woo order count did not increase by exactly one during prepare.”)

### Fake coverage gap

`tests/bridge/fake-woo-runtime.php` `create_prepared_order()` does **not** apply this global delta guard (it exposes `count_orders()` / `competing_checkout()` for stock races only). Existing BR-06 prepare suites therefore do **not** prove the global-count false negative. Last-unit `competing_checkout` during reserve proves stock contention (`STOCK_CHANGED`), not the post-success global delta check.

### Isolated reproduction (Lane B allowlist)

File: `tests/integration/sales/woo-global-order-count-concurrency.fixture.test.ts`

- Models the production global COUNT(*) delta.
- Injects a concurrent non-POS storefront order during prepare.
- **REPRODUCED:** prepare fails closed with `INTEGRATION_UNAVAILABLE` while `posOrderCount === 1` and `globalDelta === 2`, leaving an orphaned reserved POS order from the caller’s perspective.
- Fixture tests: **3 PASS** (documents the defect; does not claim a bridge fix).

### Fix decision

- Real defect is in `wordpress/**` (WS2). Lane B allowlist forbids editing that domain; no POS-side adapter bug inside allowlist was proven that would safely neutralize the false negative without weakening commercial guards or inventing blind retries.
- **No bridge/POS runtime patch in this lane.**
- Recommended WS2 smallest fix (handoff only): stop treating unrelated global HPOS inserts as prepare failure; prove the created order identity (recovery token / transaction meta / create_calls) instead of `global_after - global_before === 1`. Keep fail-closed on ambiguous multi-POS-order identity.

## Live runtime plan

Concrete reviewable plan (not executed):  
`docs/testing/parallel-completion-2026-10-07/LANE-B-LIVE-RUNTIME-PLAN.md`

## Staff-documentation impact

**NONE** for this lane’s delivered artifacts (evidence docs + isolated fixture + CURRENT-WORK checkpoint only). No cashier/manager-facing behavior, copy, permissions, warnings, or staff test steps changed in POS runtime code.

## Blockers

1. **WS2 global Woo order-count race** — reproduced; bridge patch required outside Lane B allowlist before live prepare under concurrent storefront/HPOS traffic can be trusted.
2. Live cash/stock/payment rehearsal — **not authorized / not executed** (plan only).

## Next action

1. WS2: implement + test the smallest bridge identity-based prepare proof (replace global count delta false negative); mirror the guard in `fake-woo-runtime` so BR-06 catches regressions.
2. Integration owner: after WS2 fix SHA is declared, authorize training rehearsal per `LANE-B-LIVE-RUNTIME-PLAN.md` (operator write grant required).
3. Lane B: no further POS commercial edits required from this evidence set.
