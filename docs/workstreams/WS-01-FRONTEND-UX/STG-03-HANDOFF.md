# WS1 handoff — STG-03 / FE-07 staging recovery

Kind / UTC: TASK_COMPLETION / 2026-09-17T12:53:01Z
Task / parent / workstream: STG-03 issue #72 + FE-07 issue #12 / STG-01 issue #70 / WS1
Owner / integration editor: Ben (`@Ben-001-sys`) owns this WS1 contribution. STG-01/WS3 integration editor owns App Router composition, independent review, import, and merge. WS1 must not merge this contribution.
Branch: `ws1/stg-03-approved-workspaces`
Accepted starting/base SHA: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`
Exact tested source SHA: `169f8155fe4cb34b6fe27db3bb6b445a13ade712`
Source tree: `e29e6febcdabee5d5a23f7496ce8a48bfa769f78`
CI evidence: run #454, `https://github.com/WB-DevWorld/cetech-pwa-pos/actions/runs/35223351197` — SUCCESS on exact source SHA.

## Scope completed

Production-intent, provider-neutral reusable presentation surfaces were added for:

- Orders, including search/filter, responsive list/table, detail, reprint entry and return entry semantics.
- Customers, including retail/wholesale distinction, search/list, selection seam and explicit offline/degraded behavior.
- Settings, including device/register/scanner/printer display, appearance seam, diagnostics and Store Health navigation.
- Store Health, including `StoreHealth`/`HealthCheck` rendering, pending/attention counts, degraded/unavailable/unverified states and recovery entry points.
- Needs attention, with guarded view-only recovery items and only explicitly supplied safe actions.
- Update ready: safe/defer/critical-operation-blocked states.
- Connectivity/offline/degraded notices.
- Passive-tab read-only notice.
- Local data migration running/blocked/failed/complete states.
- Fix App non-destructive-first recovery panel, with destructive reset disabled during a critical operation.

Sell, Returns and Register source was not changed. No provider/Woo/Supabase/Paystack behavior was implemented.

## Allowed / forbidden path evidence

Source change is exactly one commit ahead of the accepted base and changes only `apps/pos-web/src/features/**` and `apps/pos-web/src/ui/**`. There are no changes to `src/app/**`, `src/core/**`, `src/server/**`, `src/local/**`, `src/config/**`, `wordpress/**`, `supabase/**`, `.github/**`, contracts, or provider code.

## Files changed in tested source SHA

1. `apps/pos-web/src/features/customers/CustomersScreen.test.tsx`
2. `apps/pos-web/src/features/customers/CustomersScreen.tsx`
3. `apps/pos-web/src/features/customers/customers.css`
4. `apps/pos-web/src/features/customers/index.ts`
5. `apps/pos-web/src/features/orders/OrdersScreen.test.tsx`
6. `apps/pos-web/src/features/orders/OrdersScreen.tsx`
7. `apps/pos-web/src/features/orders/index.ts`
8. `apps/pos-web/src/features/orders/orders.css`
9. `apps/pos-web/src/features/settings/SettingsScreen.test.tsx`
10. `apps/pos-web/src/features/settings/SettingsScreen.tsx`
11. `apps/pos-web/src/features/settings/index.ts`
12. `apps/pos-web/src/features/settings/settings.css`
13. `apps/pos-web/src/ui/index.ts`
14. `apps/pos-web/src/ui/operational/OperationalSurfaces.test.tsx`
15. `apps/pos-web/src/ui/operational/OperationalSurfaces.tsx`
16. `apps/pos-web/src/ui/operational/index.ts`
17. `apps/pos-web/src/ui/operational/operational.css`
18. `apps/pos-web/src/ui/workspace.css`

## Contracts / migrations / ADRs

Contracts changed: none. Frozen v1.0.0 is consumed.
Database migrations: none.
ADRs authored: none. ADR-012 and ADR-014 are followed; ownership remains unchanged.

Existing canonical contract use:
- `CustomerSummary` for Customers.
- `StoreHealth` and `HealthCheck` for Store Health.
- `Money` for normalized Orders presentation.
- Existing transaction/payment/return/register semantics are not redefined by these components.

## Exact contract blockers

1. **Orders read/query blocker:** frozen v1.0.0 has no provider-neutral Orders list/query port and no canonical `OrderSummary` read model. `ReceiptPort.getByTransaction` and the sale/payment/return ports do not provide order-history collection semantics. WS1 therefore exposes `OrderListItemView` / `OrderDetailView` as presentation-only input. WS3 must use an already-approved producer or obtain an approved contract change; do not wire direct Woo calls into this UI.
2. **Needs Attention collection/action blocker:** frozen v1.0.0 has `PendingOperation` and operation-specific resolve methods but no canonical `AttentionItem` collection/action contract. `AttentionItemView` is presentation-only. `resolveAllowed` / `retryAllowed` must be set only when WS3 has a current approved use case for that exact operation; otherwise render the item read-only.
3. **Settings persistence blocker:** no general WS1-owned Config/Device settings write port exists. `PosSettingsView` is injected display state; appearance and navigation callbacks delegate to existing app-owned mechanisms only.
4. **Update/migration/passive-tab coordination:** FE-07 presentation exists, but the release/service-worker, local migration, active-tab and destructive-recovery coordinators remain WS3/core/local owners. WS1 does not fabricate those effects.

## Required checks and evidence

Exact tested source SHA: `169f8155fe4cb34b6fe27db3bb6b445a13ade712`.

- `python3 scripts/verify_control_plane.py` — PASS in Linux and Windows CI (`Verify foundation and contracts`).
- `pnpm --dir apps/pos-web lint` — PASS in Linux and Windows CI.
- `pnpm --dir apps/pos-web typecheck` — PASS in Linux and Windows CI.
- `pnpm --dir apps/pos-web test` — PASS in Linux and Windows CI.
- `pnpm --dir apps/pos-web test:e2e` — PASS in Linux CI (`App E2E smoke`; production build also PASS).
- `git diff --check` — PASS against the exact accepted base → tested source diff.
- Linux Supabase reset + pgTAP regression gate — PASS.
- Windows production build — PASS.

CI URL: `https://github.com/WB-DevWorld/cetech-pwa-pos/actions/runs/35223351197`
Source commit: `https://github.com/WB-DevWorld/cetech-pwa-pos/commit/169f8155fe4cb34b6fe27db3bb6b445a13ade712`

## Screenshot / device evidence

Implementation-runtime screenshots are **not claimed by WS1** because this assignment explicitly forbids `apps/pos-web/src/app/**`; these leaf components are intentionally not mounted on this branch. The approved artifact screenshots remain design/product authority, not evidence that this source SHA is mounted in staging.

FE-07 installed Android/iPhone evidence is therefore **MISSING / INTEGRATION-PENDING** as permitted by issue #12 when a device/runtime mount is unavailable. WS3 must capture desktop/tablet/mobile screenshots and installed-device evidence after importing this exact source SHA and mounting it. WS1 must not create a fake App Router harness or modify staging merely to manufacture screenshots.

## Exact WS3 mounting instructions

### Shared CSS

At the WS3-owned app/global composition layer, include:

- `@/ui/workspace.css`
- `@/features/orders/orders.css`
- `@/features/customers/customers.css`
- `@/features/settings/settings.css`
- `@/ui/operational/operational.css`

The feature modules also export `ORDER_STYLESHEETS`, `CUSTOMER_STYLESHEETS`, `SETTINGS_STYLESHEETS`, `OPERATIONAL_STYLESHEETS` for explicit composition documentation.

### `/orders`

Import `OrdersScreen` and `OrderDetailDialog` from `@/features/orders`.

- Populate `orders` only from an approved provider-neutral/internal read producer.
- Current contract blocker: no frozen v1 Orders list/query port. If no approved producer exists, mount a truthful empty/degraded state; do not add direct Woo calls to the component.
- `onSelectOrder` opens `OrderDetailDialog` with normalized `OrderDetailView` data.
- `onReprint` must delegate to the existing receipt/print application use case (`ReceiptPort` / `PrintPort`) using the original transaction identity.
- `onStartReturn` must delegate/navigation-bind to the existing Returns workflow using the original sale/order identity. Do not reconstruct return economics in Orders UI.

### `/customers`

Import `CustomersScreen` from `@/features/customers`.

- Call the existing `CustomerPort.search()` from WS3/core composition and pass the returned `CustomerSummary[]`.
- Pass `selectedCustomerId` from current Sell/customer context if available.
- `onUseCustomer` hands the selected canonical customer identity into the existing Sell customer-context workflow/navigation.
- Do not calculate B2B/wholesale prices in Customers UI.

### `/settings`

Import `SettingsScreen` from `@/features/settings`.

- Build `PosSettingsView` from existing safe device/register/build/contract data only.
- `onAppearanceChange` delegates to the app's existing preference/theme owner; no provider settings write belongs here.
- `onOpenStoreHealth` navigates to `/health`.
- Do not expose secrets or privileged provider configuration.

### `/health`

Import `StoreHealthScreen` from `@/ui` (or `@/ui/operational`).

- Call existing `HealthPort.getStoreHealth()` and pass the returned `StoreHealth`.
- Map loading/error/offline/degraded states from real composition state.
- Wire `onFixApp`, `onOpenAttention`, and `onRebuildCatalog` only to already-approved WS3 recovery/sync/navigation use cases.

### `/attention`

Import `NeedsAttentionScreen` from `@/ui`.

- Project only known existing transaction/payment/refund/return/register/journal state into `AttentionItemView`.
- Set `resolveAllowed` and `retryAllowed` only when an approved operation-specific use case exists.
- If no safe action exists, leave both false/undefined; the component renders a read-only recovery message.
- Do not invent a generic provider write or "mark resolved" endpoint.

### Shell/global recovery composition

- `ConnectivityNotice`: feed the current connectivity state.
- `PassiveTabNotice`: feed the active/passive-tab coordinator state. WS3 must enforce mutation blocking; this component is presentation only.
- `UpdateReadyDialog`: feed release/update coordinator state. Use `safety="safe"` only when the coordinator says no critical cart/payment/journal/migration work blocks activation; use `blocked_critical` during unsafe transaction recovery. `onApply` belongs to WS3.
- `LocalDataMigrationPanel`: feed the local DB migration/lock state. Do not clear critical local state from WS1 callbacks.
- `FixAppPanel`: derive `criticalOperationActive` from the real operation/recovery coordinator. Bind last-resort reset only if an approved destructive recovery procedure already exists.

## Remote effects / limitations

Remote effects performed: contributor branch push and GitHub CI only. No production deploy, provider write, refund, payment, stock effect, database migration, VitePOS change, or staging App Router composition was performed.

The source contribution alone does not remove the staging placeholder. STG-01 integration remains required to import this SHA and replace WS3's placeholder routing.

No R9 or later feature work was started.

## Next exact action

STG-01 / WS3 integration editor independently reviews and imports tested source SHA `169f8155fe4cb34b6fe27db3bb6b445a13ade712`, mounts Orders/Customers/Settings/Health/Attention and recovery surfaces under WS3-owned `src/app/**` composition, runs the combined exact-head suite, captures desktop/tablet/mobile + installed-device evidence, and publishes staging. WS1 stops here and does not merge its own contribution.
