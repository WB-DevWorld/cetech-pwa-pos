# R9 reconciliation onto final accepted R8 `main`

Date: 2026-09-17. Integration editor: `@wbdevworld` / WS3. Mode: RECONCILE / INTEGRATE. No secrets.

This is code reconciliation of reviewed CORE-07 + FE-07 onto squash-merged R8. It is **not** R9 milestone acceptance, **not** installed-client/device evidence, **not** R10, and **not** final ADR-012 freshness.

## Refs used

| Role | SHA / id |
| --- | --- |
| Protected `origin/main` (this task) | `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` |
| Accepted R8 squash merge | `[R8] Safe returns and payment/register states (#69)` |
| R8 post-merge CI | `35216668259` SUCCESS |
| Historical R9 head (pre-reconciliation) | `13af56ca86d13657736b8c5156b73a8e79664130` |
| Historical merge-base (R6) | `bd79c2901ce33c3177141d4244cc196be0a719d2` |
| Divergence at start | R9 48 commits ahead of merge-base; `main` 6 commits ahead of merge-base; branch and `main` diverged |
| PR | `#63` remains **DRAFT** |
| Branch | `batch/r9-pwa-recovery-operational-close` |
| Method | `git merge --no-ff --no-commit origin/main` then semantic compose. **No rebase. No force push.** |

`main` had **not** moved past `778348c…` at reconciliation start. Independent review of `13af56c…` is provenance only; this work changes the exact head.

Exact replacement SHA is the merge commit that includes this evidence. Record it from `git rev-parse HEAD` after push; it cannot be self-referential here.

## Path classification

```text
BASE    = bd79c2901ce33c3177141d4244cc196be0a719d2
OLD_R9  = 13af56ca86d13657736b8c5156b73a8e79664130
R8_MAIN = 778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5
```

| Rule | Count | Meaning |
| --- | ---: | --- |
| A | 204 | Changed after R6 only by R7/R8. Preserve `origin/main` unless a documented R9 integration dependency requires an edit. |
| B | 42 | Changed only by R9. Retain reviewed R9, adapt only for R8 compatibility. |
| C | 4 | Changed by both sides (textual three-way). Manually compose. |

Semantic duplicate-authority conflicts are recorded below even when Git did not conflict.

### Rule C — shared textual three-way

| Path | Decision |
| --- | --- |
| `CURRENT-WORK.md` | Rewritten as current-truth ledger. R8 merged on `main`; R9-REC-01 active; PR #63 remains DRAFT; R10 not started; historical R6/R7/R8 SHAs preserved as provenance. Not a line-wise merge of the two stale ledgers. |
| `apps/pos-web/src/app/checkout-client.ts` | Git auto-merged. Verified: R8 `createBrowserReturnPort` / `createBrowserRegisterPort` / `fetchImpl` remain; R9 `tenderActivity?: TenderActivityPort` is wired so successful `prepare` marks tender active immediately; cash/electronic/resolve keep the marker; clear only on terminal `completed` or `cancelled`. `RegisterPort.close` still returns `ApiResult<Shift>` via `POST /api/pos/v1/shifts/close`. |
| `apps/pos-web/src/app/layout.tsx` | Compose both: keep R8 `sell.css` / `returns.css` / `register.css`; add R9 `health.css`; wrap `{children}` in `PwaLifecycleRuntime` at the root POS boundary. Current metadata retained. |
| `apps/pos-web/src/app/pos-app.tsx` | Start from R8 `PosRuntime` (`sell` / `returns` / `register`, `fetchImpl`, historic return lookup). Add FE-07 `HealthRuntime` on `/health`. When opening the local DB for Sell, `createTenderActivityPort(db)` is passed into `createBrowserCashCheckoutPorts`. Returns/Register are not placeholders. |

Textual Git conflicts were: `CURRENT-WORK.md`, `layout.tsx`, `pos-app.tsx`. `checkout-client.ts` did not conflict textually.

### Semantic conflicts (not solely textual)

| Domain | Conflict | Resolution |
| --- | --- | --- |
| Operational close | R9 `register/close-shift.ts` + `pos_close_shift_blind` closed and minted Z even with non-zero variance. R8 production BFF is `POST /api/pos/v1/shifts/close` → `ApiResult<Shift>` with `varianceMinor === 0 ? closed : requires_attention`. | One production path: `apps/pos-web/src/server/sales/close-shift.ts` remains the application use-case. R9 `OperationalCloseStore` is optional infrastructure behind that use-case. Deleted competing `apps/pos-web/src/server/register/close-shift.ts`. Retargeted `register/close-shift.test.ts` to `sales/close-shift`. Wire: close route → `handleCloseShift` → `closeShift` with `closeStore` from `composePosCommandHandlers` when Supabase infra exists. HTTP still returns `ApiResult<Shift>` only. |
| Variance / `approvalId` | Old R9 RPC treated close as blind success. R8: `approvalId` is schema-compatible and has **zero** close authority. | Additive migration `20260917140000_pos_operational_close_r8_variance.sql` `CREATE OR REPLACE FUNCTION pos_close_shift_blind` so zero variance atomically closes + one Z; non-zero records counted cash, sets `requires_attention`, no `closedAt`, no Z. Historical `20260915223000_pos_operational_close.sql` is **not** rewritten. |
| Z report | R8 BFF synthesized a Z from current shift fields. R9 requires immutable exactly-once `pos_shift_reports`. | `handleGetShiftReport` for `kind=Z` reads durable `CheckoutStore.getShiftReport`. Missing durable Z on a closed shift is `INTEGRATION_UNAVAILABLE`. X remains a server-derived read projection. In-memory CheckoutStore persists Z on zero-variance close. |
| Control-plane docs | R8 STATUS/HANDOFF (Rule A) still described active R8 PR #69. | Updated to R9-REC-01 current truth. Historical R8 SHAs retained as provenance. |
| WS3-generated bridge fixtures | Working-tree fingerprint drift vs `origin/main` after local generation. | Restored byte-for-byte from `origin/main` (`commercial-partial-1.json`, `commercial-partial-2.json`, `stock-disposition.json`). |

### Rule A — current-main-only (204)

Byte-for-byte `origin/main` after merge **except** the documented integration edits listed in the next subsection.

```text
.env.example
.github/workflows/deploy-staging.yml
apps/pos-web/e2e/returns-register.spec.ts
apps/pos-web/scripts/run-ws3-return-commands.mjs
apps/pos-web/src/app/api/pos/v1/payments/callback/route.ts
apps/pos-web/src/app/api/pos/v1/payments/initialize/route.ts
apps/pos-web/src/app/api/pos/v1/payments/providers/paystack/webhook/route.ts
apps/pos-web/src/app/api/pos/v1/payments/resolve/route.ts
apps/pos-web/src/app/api/pos/v1/registers/[registerId]/active-shift/route.ts
apps/pos-web/src/app/api/pos/v1/registers/[registerId]/route.ts
apps/pos-web/src/app/api/pos/v1/returns/[returnId]/route.ts
apps/pos-web/src/app/api/pos/v1/returns/execute/route.ts
apps/pos-web/src/app/api/pos/v1/returns/history/[saleKey]/route.ts
apps/pos-web/src/app/api/pos/v1/returns/preview/route.ts
apps/pos-web/src/app/api/pos/v1/shifts/[shiftId]/report/route.ts
apps/pos-web/src/app/api/pos/v1/shifts/close/route.ts
apps/pos-web/src/app/register-runtime.tsx
apps/pos-web/src/app/returns-runtime.tsx
apps/pos-web/src/config/env.test.ts
apps/pos-web/src/config/env.ts
apps/pos-web/src/config/secrets.ts
apps/pos-web/src/core/checkout/in-memory-store.ts
apps/pos-web/src/core/checkout/monotonic.ts
apps/pos-web/src/core/checkout/types.ts
apps/pos-web/src/core/returns/aggregate.ts
apps/pos-web/src/core/returns/disposition.ts
apps/pos-web/src/core/returns/in-memory-store.ts
apps/pos-web/src/core/returns/quantities.ts
apps/pos-web/src/core/returns/types.ts
apps/pos-web/src/features/payments/ElectronicPaymentPanel.tsx
apps/pos-web/src/features/payments/RefundReconciliationPanel.tsx
apps/pos-web/src/features/payments/electronicPaymentController.ts
apps/pos-web/src/features/payments/electronicPaymentView.ts
apps/pos-web/src/features/payments/index.ts
apps/pos-web/src/features/payments/payments.css
apps/pos-web/src/features/payments/refundReconciliationController.ts
apps/pos-web/src/features/payments/refundReconciliationView.ts
apps/pos-web/src/features/payments/useElectronicPayment.ts
apps/pos-web/src/features/register/CloseShiftForm.tsx
apps/pos-web/src/features/register/RegisterScreen.tsx
apps/pos-web/src/features/register/index.ts
apps/pos-web/src/features/register/register.css
apps/pos-web/src/features/register/registerController.ts
apps/pos-web/src/features/register/shiftView.ts
apps/pos-web/src/features/returns/ReturnFlow.tsx
apps/pos-web/src/features/returns/ReturnsScreen.tsx
apps/pos-web/src/features/returns/index.ts
apps/pos-web/src/features/returns/returnController.ts
apps/pos-web/src/features/returns/returnView.ts
apps/pos-web/src/features/returns/returns.css
apps/pos-web/src/features/returns/useReturnFlow.ts
apps/pos-web/src/features/sell/SellScreen.tsx
apps/pos-web/src/features/sell/components/CheckoutDialog.tsx
apps/pos-web/src/features/sell/runtime/SellRuntimeScreen.tsx
apps/pos-web/src/features/sell/sell.css
apps/pos-web/src/server/auth/roles.ts
apps/pos-web/src/server/payments/apply-verification.ts
apps/pos-web/src/server/payments/compose-payment-provider.ts
apps/pos-web/src/server/payments/config.ts
apps/pos-web/src/server/payments/fake-provider.ts
apps/pos-web/src/server/payments/fake-refund-provider.ts
apps/pos-web/src/server/payments/handle-initialize-payment.ts
apps/pos-web/src/server/payments/handle-paystack-webhook.ts
apps/pos-web/src/server/payments/handle-resolve-refund.ts
apps/pos-web/src/server/payments/hmac.ts
apps/pos-web/src/server/payments/ingest-provider-event.ts
apps/pos-web/src/server/payments/initialize-electronic.ts
apps/pos-web/src/server/payments/payer-email.ts
apps/pos-web/src/server/payments/payment-state.ts
apps/pos-web/src/server/payments/paystack-provider.ts
apps/pos-web/src/server/payments/paystack-refund.ts
apps/pos-web/src/server/payments/provider.ts
apps/pos-web/src/server/payments/reference.ts
apps/pos-web/src/server/payments/refund-provider.ts
apps/pos-web/src/server/payments/refund.ts
apps/pos-web/src/server/payments/resolve-electronic.ts
apps/pos-web/src/server/returns/approval.ts
apps/pos-web/src/server/returns/bridge-commands.ts
apps/pos-web/src/server/returns/compose-return-bridge.ts
apps/pos-web/src/server/returns/compose-return-runtime.ts
apps/pos-web/src/server/returns/compose-return-store.ts
apps/pos-web/src/server/returns/execute.ts
apps/pos-web/src/server/returns/fake-bridge-return-effects.ts
apps/pos-web/src/server/returns/fingerprint.ts
apps/pos-web/src/server/returns/handle-execute-return.ts
apps/pos-web/src/server/returns/handle-get-historic-return-sale.ts
apps/pos-web/src/server/returns/handle-preview-return.ts
apps/pos-web/src/server/returns/handle-resolve-return.ts
apps/pos-web/src/server/returns/historic-sale-projection.ts
apps/pos-web/src/server/returns/preview.ts
apps/pos-web/src/server/returns/resolution.ts
apps/pos-web/src/server/returns/resolve.ts
apps/pos-web/src/server/returns/schema.ts
apps/pos-web/src/server/returns/supabase-return-store.ts
apps/pos-web/src/server/sales/authorize-checkout.ts
apps/pos-web/src/server/sales/close-shift.ts
apps/pos-web/src/server/sales/compose-pos-command-runtime.ts
apps/pos-web/src/server/sales/confirm-cash.ts
apps/pos-web/src/server/sales/finalize-sale.ts
apps/pos-web/src/server/sales/handle-close-shift.ts
apps/pos-web/src/server/sales/handle-get-active-shift.ts
apps/pos-web/src/server/sales/handle-get-register.ts
apps/pos-web/src/server/sales/handle-get-shift-report.ts
apps/pos-web/src/server/sales/handle-resolve-payment.ts
apps/pos-web/src/server/sales/instrumented-bridge-sales-port.ts
apps/pos-web/src/server/sales/open-shift.ts
apps/pos-web/src/server/sales/prepare-sale.ts
apps/pos-web/src/server/sales/schema.ts
apps/pos-web/src/server/sales/shift-public.ts
apps/pos-web/src/server/sales/supabase-checkout-store.ts
apps/pos-web/vitest.config.mts
docs/contracts/API-CONVENTIONS.md
docs/contracts/DOMAIN-CONTRACTS.md
docs/contracts/ERROR-CONTRACT.md
docs/contracts/README.md
docs/contracts/bridge-api.openapi.json
docs/contracts/domain.generated.ts
docs/contracts/ports.ts
docs/contracts/pos-domain.schema.json
docs/decisions/ADR/015.md
docs/decisions/DECISION-REGISTER.md
docs/integration/evidence/R7-ACTIVATION.md
docs/integration/evidence/R7-PAY-01-CONCURRENCY.md
docs/integration/evidence/R7-PAY-01-FRESHNESS.md
docs/integration/evidence/R7-PAY-01-IMPORT.md
docs/integration/evidence/R7-PAY-01-MILESTONE-FRESHNESS.md
docs/integration/evidence/R7-PAY-01-SANDBOX.md
docs/integration/evidence/R7-PAY-01-SOURCE.md
docs/integration/evidence/R7-PAY-01-TEST-KEY-HARDENING.md
docs/integration/evidence/R7-PAY-01-TEST-KEY-IMPORT.md
docs/integration/evidence/R8-FINAL-R7-RECONCILIATION.md
docs/integration/evidence/R8-REVIEW-REMEDIATION.md
docs/runbooks/CD-01-STAGING-DEPLOYMENT.md
docs/workstreams/WS-01-FRONTEND-UX/HANDOFF.md
docs/workstreams/WS-01-FRONTEND-UX/STATUS.md
docs/workstreams/WS-02-COMMERCE-BRIDGE/HANDOFF.md
docs/workstreams/WS-02-COMMERCE-BRIDGE/STATUS.md
docs/workstreams/WS-02-COMMERCE-BRIDGE/evidence/BR-08-RETURN-EFFECTS.md
docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md
docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md
supabase/migrations/20260915180000_pos_electronic_payment.sql
supabase/migrations/20260915200000_pos_returns.sql
supabase/migrations/20260916120000_pos_payment_monotonic.sql
supabase/migrations/20260916220000_pos_return_line_allocations.sql
supabase/migrations/20260917090000_pos_return_line_allocation_nonnegative.sql
supabase/tests/electronic_payment.sql
supabase/tests/payment_monotonic.sql
supabase/tests/pos_returns.sql
tests/bridge/bootstrap.php
tests/bridge/fake-woo-runtime.php
tests/bridge/fixtures/ws3-generated/commercial-partial-1.json
tests/bridge/fixtures/ws3-generated/commercial-partial-2.json
tests/bridge/fixtures/ws3-generated/manifest.json
tests/bridge/fixtures/ws3-generated/stock-disposition.json
tests/bridge/run.php
tests/bridge/test-health.php
tests/bridge/test-prepare.php
tests/bridge/test-quote-schema.php
tests/bridge/test-return-effects.php
tests/bridge/test-ws3-generated-return-effects.php
tests/bridge/tools/run-ws3-return-commands.mts
tests/contracts/fixtures.json
tests/contracts/return-refund-wire.test.ts
tests/frontend/electronic-payment.test.ts
tests/frontend/evidence/login-desktop.html
tests/frontend/evidence/register-desktop.html
tests/frontend/evidence/sell-customer.html
tests/frontend/evidence/sell-desktop.html
tests/frontend/evidence/sell-offline.html
tests/frontend/evidence/sell-phone.html
tests/frontend/evidence/sell-tablet.html
tests/frontend/evidence/sell-unknown-barcode.html
tests/frontend/evidence/sell-variation.html
tests/frontend/evidence/shell-desktop.html
tests/frontend/pos-app-returns-register.test.ts
tests/frontend/register-close.test.ts
tests/frontend/returns-flow.test.ts
tests/integration/payments/durable-electronic-store.test.ts
tests/integration/payments/electronic-payment.test.ts
tests/integration/payments/helpers.ts
tests/integration/returns/generate-ws3-bridge-commands.ts
tests/integration/returns/helpers.ts
tests/integration/returns/historic-sale-projection.test.ts
tests/integration/returns/payment-regressions.test.ts
tests/integration/returns/r8-historic-sale-lookup.test.ts
tests/integration/returns/r8-review-remediation.test.ts
tests/integration/returns/return-bff-routes.test.ts
tests/integration/returns/return-runtime.test.ts
tests/integration/sales/close-shift-variance.test.ts
tests/integration/sales/fake-posgrest.ts
tests/tooling/test_vitest_discovery.py
wordpress/cetech-pos-bridge/Makefile
wordpress/cetech-pos-bridge/cetech-pos-bridge.php
wordpress/cetech-pos-bridge/includes/class-commercial-refund-controller.php
wordpress/cetech-pos-bridge/includes/class-constants.php
wordpress/cetech-pos-bridge/includes/class-plugin.php
wordpress/cetech-pos-bridge/includes/class-return-effect-engine.php
wordpress/cetech-pos-bridge/includes/class-return-effect-store.php
wordpress/cetech-pos-bridge/includes/class-schema-install.php
wordpress/cetech-pos-bridge/includes/class-schema.php
wordpress/cetech-pos-bridge/includes/class-stock-disposition-controller.php
wordpress/cetech-pos-bridge/includes/class-woo-runtime.php
wordpress/cetech-pos-bridge/schema/quote-contract.v1.json
wordpress/cetech-pos-bridge/tools/derive-quote-contract.php
```

### Rule A paths intentionally edited (documented integration dependency)

These are **not** byte-for-byte `origin/main`. Each edit exists so R9 atomic close / durable Z can sit behind the accepted R8 BFF without a second browser-facing close API.

| Path | Why it differs from `origin/main` |
| --- | --- |
| `apps/pos-web/src/app/api/pos/v1/shifts/close/route.ts` | Pass `closeStore` from command composition into `handleCloseShift`. Wire contract unchanged. |
| `apps/pos-web/src/core/checkout/types.ts` | Optional `zReportId` on close; `saveShiftReport` / `getShiftReport` on CheckoutStore. |
| `apps/pos-web/src/core/checkout/in-memory-store.ts` | Persist durable Z for in-memory / unit tests. |
| `apps/pos-web/src/server/sales/close-shift.ts` | Canonical close use-case: atomic RPC when `closeStore` present; otherwise CheckoutStore path with R8 variance + durable Z persist. Still returns `ApiResult<Shift>`. |
| `apps/pos-web/src/server/sales/handle-close-shift.ts` | Optional `closeStore`; still `ApiResult<Shift>`. |
| `apps/pos-web/src/server/sales/handle-get-shift-report.ts` | Z is durable-only; X remains derived. |
| `apps/pos-web/src/server/sales/compose-pos-command-runtime.ts` | Compose `OperationalCloseStore` when Supabase infra exists. |
| `apps/pos-web/src/server/sales/supabase-checkout-store.ts` | Persist `z_report_id` / shift reports for durable Z reads. |
| `tests/integration/sales/fake-posgrest.ts` | Test double for shift-report persistence used by close/Z tests. |
| `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md` | Current-truth rewrite required by this task. |
| `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/HANDOFF.md` | Current-truth rewrite required by this task. |

Protected Rule A surfaces verified empty vs `origin/main` after restore:

- Paystack provider/refund, `apply-verification.ts`, `monotonic.ts`
- `env.ts` / `secrets.ts`
- CD-01 `deploy-staging.yml`
- Historic return lookup / return execute
- Return migrations `20260915200000`, `20260916120000`
- R7 sandbox evidence, R8 review-remediation evidence
- WS3-generated bridge fixtures (restored)

### Rule B — R9-only (42)

Reviewed R9 implementation retained as starting version. Adaptations:

- `apps/pos-web/src/server/register/close-shift.ts` **deleted** (second competing use-case).
- `apps/pos-web/src/server/register/close-shift.test.ts` retargeted to `sales/close-shift`.
- `apps/pos-web/src/server/register/operational-close-store.ts` kept as server infrastructure.
- `supabase/migrations/20260915223000_pos_operational_close.sql` **preserved** (history not rewritten).
- `supabase/tests/operational_close.sql` updated for R8 variance (zero → closed+Z; non-zero → attention, no Z).
- Recovery diagnostics still count generic non-acknowledged journal rows (covers current R8 operation types without duplicating browser truth).
- `checkout-client.test.ts` extended for R8 Return/Register ports + tender-gated activation.

```text
apps/pos-web/public/manifest.webmanifest
apps/pos-web/public/offline.html
apps/pos-web/public/pos-icon.svg
apps/pos-web/public/sw.js
apps/pos-web/src/app/api/pos/v1/release-policy/route.ts
apps/pos-web/src/app/checkout-client.test.ts
apps/pos-web/src/app/health/health-runtime.tsx
apps/pos-web/src/app/pwa-lifecycle-runtime.test.ts
apps/pos-web/src/app/pwa-lifecycle-runtime.tsx
apps/pos-web/src/config/release-policy.test.ts
apps/pos-web/src/config/release-policy.ts
apps/pos-web/src/features/health/StoreHealthScreen.tsx
apps/pos-web/src/features/health/health.css
apps/pos-web/src/features/health/index.ts
apps/pos-web/src/features/health/storeHealthController.ts
apps/pos-web/src/features/health/storeHealthView.ts
apps/pos-web/src/features/health/useStoreHealth.ts
apps/pos-web/src/local/index.ts
apps/pos-web/src/local/mounted-update-safety.ts
apps/pos-web/src/local/pwa-lifecycle.test.ts
apps/pos-web/src/local/pwa-lifecycle.ts
apps/pos-web/src/local/recovery-diagnostics.test.ts
apps/pos-web/src/local/recovery-diagnostics.ts
apps/pos-web/src/local/release-policy-client.test.ts
apps/pos-web/src/local/release-policy-client.ts
apps/pos-web/src/local/service-worker-lifecycle.test.ts
apps/pos-web/src/local/service-worker-lifecycle.ts
apps/pos-web/src/local/tender-activity.test.ts
apps/pos-web/src/local/tender-activity.ts
apps/pos-web/src/server/register/close-shift.test.ts
apps/pos-web/src/server/register/close-shift.ts   # deleted in this reconciliation
apps/pos-web/src/server/register/operational-close-store.ts
apps/pos-web/src/server/release/handle-release-policy.test.ts
apps/pos-web/src/server/release/handle-release-policy.ts
supabase/migrations/20260915223000_pos_operational_close.sql
supabase/tests/operational_close.sql
tests/frontend/evidence/health-desktop.html
tests/frontend/evidence/health-phone.html
tests/frontend/evidence/health-tablet.html
tests/frontend/store-health.test.ts
tests/frontend/visual-harness.test.ts
tests/frontend/visual/build-store-health-harness.ts
```

### New files added in this reconciliation (not in BASE..OLD_R9 / BASE..R8_MAIN three-way)

- `supabase/migrations/20260917140000_pos_operational_close_r8_variance.sql`
- `tests/integration/sales/r9-r8-reconciliation.test.ts`
- `tests/frontend/pos-app-r9-r8-routes.test.ts`
- `docs/integration/evidence/R9-R8-RECONCILIATION.md` (this file)

## Final close architecture

```text
POST /api/pos/v1/shifts/close  → handleCloseShift → closeShift
                                 ApiResult<Shift> only
GET  /api/pos/v1/shifts/{shiftId}/report?kind=Z
                                 durable pos_shift_reports / CheckoutStore.getShiftReport
RegisterPort.close / report      unchanged frozen v1 wires
```

Production with Supabase infra: `createSupabaseOperationalCloseStore` → RPC `pos_close_shift_blind` (R8 semantics after corrective migration).

In-memory tests: CheckoutStore close + persist Z when variance is zero.

`approvalId` is accepted on the request schema and ignored for close authority.

## Migrations

| File | Action |
| --- | --- |
| `20260915223000_pos_operational_close.sql` | Preserved. Historical R9 provenance. |
| `20260917140000_pos_operational_close_r8_variance.sql` | Additive. Redefines RPC body for R8 variance. Does not rewrite history. |

Windows `npx supabase db reset` remains BLOCKED by cmd quoting. Docker applied `20260915223000` then `20260917140000`; pgTAP via `docker exec supabase_db_cetech-pwa-pos psql`.

## Tests (pre-commit, this workstation)

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `python -m unittest discover -s tests/tooling -v` | 48 OK |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | **83 files / 747 tests** PASS |
| `pnpm --dir apps/pos-web build` | PASS |
| `.next/static` secret scan (`sk_live_` / `PAYSTACK_SECRET` / `NEXT_PUBLIC_PAYSTACK`) | no matches |
| `pnpm --dir apps/pos-web test:e2e` | **9 passed**, `--workers=1`, Playwright browsers from `%LOCALAPPDATA%\ms-playwright` |
| `git diff --check` | clean |
| WSL `make -C wordpress/cetech-pos-bridge check` | PASS |
| Windows `php.exe tests/bridge/run.php` | **1555 passed, 0 failed** |
| Windows `php.exe tests/bridge/parity.php` | **138 passed, 0 failed, 19 skipped** |
| `npx supabase db reset --yes --local` | BLOCKED on Windows cmd quoting. Not invented PASS. |

pgTAP (Docker apply + `psql`):

| Suite | Count |
| --- | --- |
| rls_isolation | 81 |
| prepare_scope_binding | 8 |
| durable_checkout | 17 |
| cash_sale_uniqueness | 7 |
| electronic_payment | 16 |
| payment_monotonic | 6 |
| pos_returns | 43 |
| operational_close | 22/22 |

### Targeted R9 regressions (automated)

Covered by `service-worker-lifecycle.test.ts`, `pwa-lifecycle.test.ts`, `pwa-lifecycle-runtime.test.ts`, `checkout-client.test.ts`, `recovery-diagnostics.test.ts`, `release-policy` tests:

- old installed A discovers server-advertised B worker (`latestBuild` → worker URL; running app remains A)
- waiting B is not auto-activated during active tender / critical work / passive window
- ReleasePolicy minimum-supported gate
- root `PwaLifecycleRuntime` wraps children (layout source + runtime tests)
- multi-tab lease blocks competing activation
- reconnect does not destroy local work
- local schema incompatibility blocks activation
- recovery diagnostics count pending journal rows and do not clear durable state

These are **not** installed-client/device evidence.

### Targeted R8 regressions (automated)

Covered by electronic-payment / monotonic / cash-finalize / returns / historic lookup / close-shift-variance / pos-app-returns-register / E2E returns-register:

- electronic-payment monotonic + concurrency
- cash sale
- return partial allocations, zero-value allocation
- WS3→WS2 return-effect (bridge 1555 + generated fixtures)
- immutable historic `orderLineId` lookup; fabricated receipt ID rejection
- fail-closed shift variance; arbitrary approval UUID cannot close
- Returns and Register production runtimes

### New R9-on-R8 integration regressions

- `tests/integration/sales/r9-r8-reconciliation.test.ts`: zero variance → closed + one durable Z; same key replay same Z; changed body same key → `IDEMPOTENCY_CONFLICT`; non-zero → `requires_attention` no Z; invented approval still attention no Z; later corrected recount with **new** key may close.
- `tests/frontend/pos-app-r9-r8-routes.test.ts`: `/sell` `/returns` `/register` `/health` mount production runtimes under root lifecycle CSS/provider composition.
- Checkout-client tests: R8 ports survive; prepare marks tender active and blocks update activation until terminal sale.

## Non-goals / non-effects

- No rebase, no force-push, no rewrite of historical R9 review evidence.
- No real Paystack charge/refund, no Woo refund/stock mutation, no production promotion, no VitePOS deactivation.
- No additional TEST payment for freshness.
- PR #63 not marked ready; not merged; CORE-07 not closed; R10 not started.
- Installed-client/device evidence is **still pending**. Automated Playwright/service-worker mocks are not that gate.
- Freshness protocol for this pass: **NOT FINAL FRESHNESS**. Final ADR-012 Pass 1+2 belongs after independent review of the reconciled exact SHA plus device evidence.

## Known limitations

- Exact-head GitHub CI is recorded after push of the replacement SHA; do not reuse CI from `13af56c…`.
- `npx supabase db reset` is still BLOCKED on this Windows workstation; Docker apply + psql is the executed path.
- Health without a mounted React lifecycle context in the static-markup route test shows “Shared lifecycle runtime is unavailable”; that still proves `HealthRuntime` is mounted rather than a placeholder. Root layout wraps all routes in `PwaLifecycleRuntime` for the real app.
- Independent mixed WS1/WS2/WS3 review of the **new** exact head is required. This editor does not self-approve.
