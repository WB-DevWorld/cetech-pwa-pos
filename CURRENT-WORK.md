# Current work ledger

Updated 2026-09-19. Canonical repo `WB-DevWorld/cetech-pwa-pos`. Historical scheduler detail remains in Git/PR/evidence history. This file controls current assignment and implementation authority.

## Temporary senior UX-04 authority — EXPIRED / CLOSED

Closed on contributor branch `ws1/ux-04-operational-workspaces-demo-alignment` after the UX-04 operational-workspace handoff. Base remained `origin/batch/stg-01-staging-runtime-acceptance` `c857b097bca5b4eaaed4a4de0e33826639a91809` (accepted UX-03-containing STG-01 / PR #77 head). This does not permanently change `OWNERSHIP.md`. Do not reuse. Do not mutate PR #77 or `batch/stg-01-staging-runtime-acceptance`. Do not merge main. Do not deploy production.

```text
human: @wbdevworld
workstream: WS1 (+ bounded WS3 integration; smallest read-only WS2 customer search) — EXPIRED / CLOSED
mode: IMPLEMENT (complete)
task: UX-04 — remaining operational workspaces demo alignment + real runtime
branch: ws1/ux-04-operational-workspaces-demo-alignment
start SHA / UX-03-containing STG-01 head: c857b097bca5b4eaaed4a4de0e33826639a91809
origin/main at close: 778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5
was allowed WS1: apps/pos-web/src/features/orders/**, customers/**, returns/**, register/**, settings/**, apps/pos-web/src/ui/operational/**, ui/shell/**, ui/workspace*, ui/toast/**, directly relevant shared UI, tests/frontend/**, docs/workstreams/WS-01-FRONTEND-UX/**
was allowed bounded WS3: apps/pos-web/src/app/workspace-runtime.tsx, pos-app.tsx, relevant BFF routes under apps/pos-web/src/app/api/**, bounded server read-model/orchestration under apps/pos-web/src/server/**, bounded local projection/state under apps/pos-web/src/local/**, directly necessary integration/e2e tests, CURRENT-WORK.md
was allowed optional WS2: wordpress/cetech-pos-bridge/** + tests/bridge/** smallest read-only GET /customers
forbidden (unchanged): UX-02/UX-03 Sell/payment redesign; Woo/B2BKing/WoodMart pricing formulas; frozen-contract edits for UI convenience; order/payment/refund/stock mutation via WS2; PR #77; shared STG-01 batch; protected main; production deploy; VitePOS cutover; Demo controls / fictional production data
```

## Temporary senior UX-03 final review-fix — EXPIRED / CLOSED

Bounded visible ProductCard refresh on `ws1/ux-03-payment-barcode-variable-range` from reviewed SHA `253ef2886ed4c447d911ba11f789375f1e35c66d`. Senior/user `@wbdevworld` reauthorized only the minimum WS1 paths to re-query the current Sell search presentation after `catalogProjectionGeneration` advances, without remounting the workspace or mutating cart/quote/checkout. This does not permanently change `OWNERSHIP.md`. Do not reuse. Do not mutate PR #77 or `batch/stg-01-staging-runtime-acceptance`.

```text
human: @wbdevworld
workstream: WS1 — EXPIRED / CLOSED
mode: IMPLEMENT (review-fix)
task: UX-03 final review-fix — refresh visible product price presentation
branch: ws1/ux-03-payment-barcode-variable-range
reviewed SHA: 253ef2886ed4c447d911ba11f789375f1e35c66d
was allowed: apps/pos-web/src/features/sell/**, tests/frontend/**, CURRENT-WORK.md, docs/workstreams/WS-01-FRONTEND-UX/**
forbidden: payment UX redesign; cancel semantics; Woo/B2BKing/WoodMart pricing; WordPress; frozen contracts; PR #77; shared STG-01 batch; protected main
```

## Temporary senior UX-03 review-fix — EXPIRED / CLOSED

Bounded cache-invalidation remediation on `ws1/ux-03-payment-barcode-variable-range` from reviewed SHA `408cbaeaf8389052cc8936d9e3dfefb0c72f4a46`. Senior/user `@wbdevworld` reauthorized only the minimum WS1/WS3 paths to add a local catalog projection generation and clear the Sell price cache when it advances, plus the selected-tender fail-closed handler. This does not permanently change `OWNERSHIP.md`. Do not reuse. Do not mutate PR #77 or `batch/stg-01-staging-runtime-acceptance`.

```text
human: @wbdevworld
workstream: WS1 (+ bounded WS3 local/app wiring) — EXPIRED / CLOSED
mode: IMPLEMENT (review-fix)
task: UX-03 review-fix — variable price cache invalidation
branch: ws1/ux-03-payment-barcode-variable-range
reviewed SHA: 408cbaeaf8389052cc8936d9e3dfefb0c72f4a46
was allowed: apps/pos-web/src/features/sell/**, apps/pos-web/src/app/pos-app.tsx, apps/pos-web/src/local/catalog-sync.ts, apps/pos-web/src/local/index.ts, tests/frontend/**, CURRENT-WORK.md, docs/workstreams/WS-01-FRONTEND-UX/**
forbidden: payment UX redesign; cancel semantics; Woo/B2BKing/WoodMart pricing; frozen contracts; PR #77; shared STG-01 batch; protected main
```

## Temporary senior UX-03 authority — EXPIRED / CLOSED

Closed on contributor branch `ws1/ux-03-payment-barcode-variable-range` after the UX-03 payment / barcode / variable-range handoff. This does not permanently change `OWNERSHIP.md`. Do not reuse this exception. Do not mutate PR #77 or `batch/stg-01-staging-runtime-acceptance` as part of this closeout.

```text
human: @wbdevworld
workstream: WS1 (+ bounded WS3 integration) — EXPIRED / CLOSED
mode: IMPLEMENT (complete)
task: UX-03 — payment experience, barcode exception states, variable-product price ranges
branch: ws1/ux-03-payment-barcode-variable-range
start SHA / UX-02 baseline: 04166509c2b9505980338e4baaf630981c00d2e8
START_FRESHNESS_SNAPSHOT UTC: 2026-09-19T08:59:20Z
origin/main at close: 778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5
origin/batch/stg-01-staging-runtime-acceptance / PR #77 head at close: 04166509c2b9505980338e4baaf630981c00d2e8
was allowed WS1: apps/pos-web/src/features/**, apps/pos-web/src/ui/**, tests/frontend/**, docs/workstreams/WS-01-FRONTEND-UX/**
was allowed bounded WS3: apps/pos-web/src/app/**, apps/pos-web/src/server/**, tests/integration/**, apps/pos-web/e2e/**
  only as required to mount frozen PaymentPort.initialize and SalesPort.cancel plus directly required tests/composition
was allowed control-plane: CURRENT-WORK.md, docs/workstreams/WS-01-FRONTEND-UX/**, directly relevant handoff/evidence
forbidden (unchanged): unrelated WS2; Woo/B2BKing/WoodMart pricing formulas; frozen-contract edits for UI convenience; unrelated schema/auth/PWA; production deploy/data; protected main; VitePOS cutover; mutating PR #77 / shared STG-01 batch
```

## Temporary senior UX-02 closeout — EXPIRED / CLOSED

Closed on `ws1/ux-02-sell-demo-alignment` after the variable-parent advisory-price review remediation. Implementation SHA `6409d4264ad67184d100a3a9c806deebe9236ad9`. This exception is no longer current assignment authority. OWNERSHIP.md is unchanged. Do not treat this as permission for further WS1/WS2/WS3 cross-ownership work.

## Current authority

- accepted `main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` — squash-merged `[R8] Safe returns and payment/register states (#69)`.
- STG-01 candidate observed on `origin/batch/stg-01-staging-runtime-acceptance` at STG-06 freshness cutoff: `a02cd21875d0717adb6694d293b41575302b2415` (forward from previously recorded `4e47a1f793bb8b75f6cf4fa03ee8f66675b4a897` by STG-02 route persistence + docs correction; this contributor branch already starts at that SHA).
- STG-02 route persistence docs-corrected head: `a02cd21875d0717adb6694d293b41575302b2415` on `ws3/stg-02-route-session-persistence`. This STG-06 contributor branch starts exactly there.
- Issue #4 remains OPEN; `pricingParityVerified=false`. Production promotion, live Paystack, real refund/restock and VitePOS deactivation are not authorized.
- R9 PR #63 remains draft / must not merge while STG-01 is open.

```text
human: @wbdevworld
workstream: WS3
mode: REMEDIATE
task: STG-06 — live quote identity mapping + register authority preservation
branch: ws3/stg-06-quote-identity-register-authority
start SHA: a02cd21875d0717adb6694d293b41575302b2415
allowed: apps/pos-web/src/server/**, apps/pos-web/src/core/**, apps/pos-web/src/app/**, apps/pos-web/src/local/**, CURRENT-WORK.md, docs/workstreams/WS-03-CORE-DATA-INTEGRATION/**, docs/integration/evidence/**
forbidden: main, R9, WS1 feature/ui redesign, WS2 plugin, auth/CSRF/RLS weakening, CatalogItem.id = Woo ID, sourceItemId in Sell UI contracts, B2BKing/WoodMart pricing in BFF/frontend, new pos_catalog_items migration unless schema is insufficient
```

Senior instruction 2026-09-18 authorizes this WS3 contributor branch from the exact SHA above. Do not modify `main`. Do not merge. Do not import/start R9. Review/merge remains independent human authority.

## STG-01 recovery context (retained)

- latest successful shared staging for merged main remains historical; application-runtime acceptance is gated on STG-01 / #70 plus this live navigation fix.
- CORE-06 / #25 and R6 / #54 remain reopened until isolated-staging runtime evidence exists.
- STG-02 original composition branch `ws3/stg-02-session-runtime-composition` established real session/CSRF/register authority. This assignment does not rewrite that; it persists that runtime across App Router navigations.


## Active STG-01 assignments

### WS3 / @wbdevworld

1. **STG-02 / #71 — staff session, CSRF and authoritative register state**
   - branch: `ws3/stg-02-session-runtime-composition`
   - remove hard-coded `Staff member` / `shiftOpen=true` authority;
   - establish real transitional staff session through the existing identity abstraction and `/api/pos/v1/session`;
   - preserve exact-origin CSRF and server authorization;
   - drive cashier/register/shift UI from authoritative server state.

2. **STG-04 / #73 — training Woo catalog projection**
   - branch: `ws3/stg-04-training-catalog-projection`
   - staging must stop treating `CASHIER_SEED_CATALOG` as operational truth;
   - local/test/demo may retain synthetic fixtures;
   - staging consumes a provider-derived, rebuildable IndexedDB projection;
   - Woo remains commerce truth; quote pricing remains bridge/Woo/B2BKing/WoodMart owned.

3. **STG-06 / #75 — functional staging acceptance gate**
   - branch: `ws3/stg-06-functional-staging-gate`
   - root HTTP smoke remains necessary but is not application acceptance;
   - acceptance must prove real session/CSRF, authoritative register state, real training projection, quote path and authorized synthetic cash-sale trace before #25/#54/#70 can close.

4. **STG-07 / #76 — CD summary audit fix**
   - branch: `ws3/stg-07-cd-summary-audit-fix`
   - fix Bash backtick command substitution in deployment summary without changing deployment semantics.

### WS2 boundary — task-specific implementation reassignment to @wbdevworld

**STG-05 / #74 — training Woo bridge producer/runtime**

- branch: `ws2/stg-05-training-bridge-runtime`
- original WS2 owner remains Emmanuel / `@Emmanuel-coder-prog`, but the senior authority explicitly reassigns implementation of this task to `@wbdevworld` for this remediation cycle because Emmanuel currently lacks SSH/repository implementation access.
- This does **not** transfer general WS2 ownership to WS3.
- Changes must remain inside STG-05's WS2-owned paths: `wordpress/cetech-pos-bridge/**`, `tests/bridge/**`, `tests/fixtures/commerce/**`, WS2 evidence/handoff.
- Do not mix WS2 bridge edits into STG-02/STG-04 branches.
- Emmanuel may still independently review the resulting GitHub PR; SSH is not required for review.

### WS1 / @Ben-001-sys

1. **STG-03 / #72**
   - branch: `ws1/stg-03-approved-workspaces`
   - implement approved production-intent Orders, Customers and Settings feature/UI surfaces;
   - do not edit provider/server/core/local logic.

2. **FE-07 / #12** remains canonical for Store Health, Attention/recovery, update/offline/degraded/passive-tab/migration UI.

Ben publishes exact tested source SHAs + mount instructions. WS3 mounts accepted WS1 components during STG-01 integration; integration ownership does not transfer WS1 implementation ownership.

## Integration order

1. STG-02 real session/CSRF/register composition.
2. STG-05 bridge producer verification/minimal repair (may run in parallel with STG-02; keep separate branch/path ownership).
3. STG-04 training catalog projection consumes the verified STG-05 producer boundary.
4. Ben delivers STG-03 + FE-07 source SHAs.
5. Integration editor imports only declared tested owner/reassigned-owner commits into `batch/stg-01-staging-runtime-acceptance`, preserving source SHA → imported SHA → tested combined SHA provenance.
6. Mount accepted WS1 features in WS3-owned app composition; no accepted route may fall through to the generic R4 placeholder.
7. Apply STG-07 audit fix.
8. Implement/run STG-06 functional staging acceptance against the exact immutable Vercel deployment produced from the candidate.
9. Capture redacted exact-SHA staging evidence; independent human review; final ADR-012 freshness procedure.
10. Only after all STG-01 gates pass may #25, #54 and #70 close and R9 resume.

## Imported provenance (this integration head)

Do not treat STG-04 contributor `CURRENT-WORK.md` as the shared ledger.

| Contribution | Owner | Source branch | Source SHA | Imported SHA |
| --- | --- | --- | --- | --- |
| STG-01 control | WS3 / @wbdevworld | `batch/stg-01-staging-runtime-acceptance` | `acd4a2f009c58f734186cf9e44f278da93499a4b` | base |
| STG-02 / #71 | WS3 / @wbdevworld | `ws3/stg-02-session-runtime-composition` | `8a6aba2ce82ebe265a154f89999c2caab7a08beb` | `9bfb535ca86f7bd27108b3a82c6876e4b5f19c81` |
| STG-05 / #74 | WS2 boundary; implementer @wbdevworld | `ws2/stg-05-training-bridge-runtime` | `4d549167f7d6dcecf0eff24f35e1f24a3429d3d8` | `7cab23415d622cef7369ddc03e007e6576cc4ce7` |
| STG-04 / #73 | WS3 / @wbdevworld | `ws3/stg-04-training-catalog-projection` | `01e4438d3553c633e7b0234de44743ff4cea2368` | `981722e7c8ff6ea7163532f03218f59ea2b9e20d` |
| STG-03 / FE-07 | WS1 / @Ben-001-sys | `ws1/stg-03-approved-workspaces` | `169f8155fe4cb34b6fe27db3bb6b445a13ade712` | `8073ef59dbf481160387000886b0b7da4a25d237` |
| STG-07 / #76 | WS3 / @wbdevworld | isolated on this integration branch | `4a978b9a67291c34c34f6cb75fddf31d14a7cbdd` | same commit |

WS3 composition (mount + session/catalog keep-both): `6df4e1edc503aa2ab0fe37f2f26a9177e6726177`. Combined tested SHA is recorded in WS3 HANDOFF after the e2e-isolation commit; it is not self-embedded here.

Semantic conflict: `apps/pos-web/src/app/pos-app.tsx` and `apps/pos-web/src/config/env.ts` plus WS3 STATUS/HANDOFF. Composition keeps STG-02 staff/CSRF/register authority and STG-04 catalog projection. `readPublicStaffAuthEnv` and `readAppEnv` both remain. Staging still never silently seeds `CASHIER_SEED_CATALOG`. Ben Orders has no frozen list port: mounted empty/unavailable, no Woo from UI, no invented contract.

## Safety boundaries

- No production promotion.
- No live electronic payment execution.
- No real customer refund/restock.
- No VitePOS deactivation.
- Training/staging effects must remain inside CP-04 authorization.
- No secrets in prompts, commits, screenshots, logs or evidence.
- No wildcard origin/CSRF bypass.
- Do not clear IndexedDB/drafts/journal as a routine recovery or catalog-sync technique.
