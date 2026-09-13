# R4 combined acceptance evidence

Milestone: **R4 — Catalog/barcode/Sell/customer/quote states**. Queue CORE-04 → FE-03 → FE-04. Review surface: existing PR **#41**. Not merged. Not R5. `pricingParityVerified` remains **false**. Issue **#4** remains **OPEN**. Production untouched.

Pre-handoff implementation SHA: `e0cc5ec407a25e174d5ee0ef376d64d64c818f5f` on `ws1/fe-03-build-sell-cart-barcode-and-customer-workflow`.
R3/main baseline: `516d6a49af74cc6677f67bdf843de6e819a05feb`.
Forward-merge of that baseline into #41 (no history rewrite): `a23f3d67293f6c5ddada89811ae9c2c0039de00b`.

## Classification

| Task | Issue | Isolated SHA | Imported on #41 | Classification |
| --- | --- | --- | --- | --- |
| CORE-04 | #23 | `73b3fd9fbe6028dc1cd5eec9b21945c987882886` (+ `0b9414102a048a03ba25f4f331238477c7b8d4fc`) | `83fb04d…` / `ae7b325…` | COMPLETE / INTEGRATED_AND_TESTED |
| FE-03 | #8 | `99b61023984f22a8a3c0444e083cce3d0a1fdc5b` | `2eb10a5…` | RUNTIME COMPLETE / INTEGRATED_AND_TESTED |
| FE-04 | #9 | `910c31cd5037d674caf23d1fcc576b8d8b0462c6` | `1cdb7e1…` | QUOTE-STATE INTEGRATION COMPLETE |

Preparation commits `2700a37`, `a751017`, `ede771b`, `3d07e89`, `f4ab194`, `700dc32` are preserved. Their “no runtime ports / no App Router / no Dexie” limitations are historical and superseded by the runtime commits above plus WS3 mount `5068fbd…` / E2E cart assertion `e0cc5ec…`.

## Combined-tree commands (worktree `cetech-pwa-pos-r4-pr41`, Node 24.21.0, pnpm 12.4.1)

```text
python scripts/verify_control_plane.py
python -m unittest discover -s tests/tooling -v
pnpm install --frozen-lockfile
pnpm --dir apps/pos-web lint
pnpm --dir apps/pos-web typecheck
pnpm --dir apps/pos-web test
pnpm --dir apps/pos-web build
pnpm --dir apps/pos-web test:e2e
pnpm --dir apps/pos-web exec playwright test --config ../../tests/frontend/visual/playwright.config.ts
git diff --check
```

| Command | Result |
| --- | --- |
| control-plane | PASS (3 workstream packages, 30 scoped tasks/DAG, 28 immutable reference files, 61 schemas, 22 contract fixtures) |
| tooling | **48 tests OK** |
| frozen install | PASS (lockfile up to date) |
| lint | PASS |
| typecheck | PASS |
| Vitest | **42 files / 229 tests PASS** |
| production build | PASS (includes `/sell` and `POST /api/pos/v1/quotes`) |
| App E2E | **1 passed** (`/sell`, scan `0012345678901` → cart line, Pay disabled) |
| Isolated visual Playwright | **12 passed** (FE-02 shell + FE-03 Sell harness; screenshots not committed) |
| `git diff --check` | clean |

Local `supabase db reset` / pgTAP was not executed on this workstation. CI `control-plane` runs that suite on the pushed head.

5,000-item catalog benchmark remains workstation-only: `docs/integration/evidence/CORE-04-ACCEPTANCE.md` (rebuild 18.14 ms). Not a production-scale claim.

## Gate checks

| Criterion | Result |
| --- | --- |
| Duplicate barcode explicit | CatalogPort `duplicate`; cashier seed shares `5550001112223` |
| Missing/unknown barcode explicit | CatalogPort `missing`; Sell unknown-barcode UX |
| Leading-zero barcode preserved as string | Fixture `0001234567890`; cashier seed `0012345678901` E2E |
| Exact variation resolves | CatalogPort parent/variation; FE-03 bypasses chooser |
| Tombstone removes stale projection entry | CORE-04 incremental test |
| Projection rebuild preserves cart drafts | CORE-04 Dexie test |
| Reload preserves unacked journal | CORE-04 Dexie test |
| Schema upgrade does not erase drafts/journal | Dexie v2→v3 test |
| No privileged/server secret in browser storage | journal secrets-guard; features/runtime do not import `@/server` or `@/config` |
| No production/customer PII fixtures | synthetic cashier + 5k generator |
| Delayed quote cannot overwrite newer revision | FE-04 `applyQuoteStateForRevision` |
| Expired/offline/stale quote blocks Pay | CheckoutEligibility + `describePayButton` (Pay also stays disabled: R4 has no payment) |
| Customer/cart revision requotes | fingerprint/revision invalidation |
| No browser/provider pricing arithmetic | BFF forwards Quote; missing bridge → `INTEGRATION_UNAVAILABLE` |
| No sale/order/payment effects | no prepare/pay/order routes added |
| Issue #4 OPEN | confirmed Pass 1/Pass 2 |
| Production untouched | no production writes |

Contracts consumed frozen v1.0.0: CatalogPort, CartDraftStore, OperationJournal, CustomerPort, PricingPort, QuoteState, CheckoutEligibility. None changed.
Migration: `supabase/migrations/20260913200000_pos_catalog_projection.sql` (rebuildable projection; trusted-server write).
ADRs authored: none. ADR-013 remains accepted through reviewed R3 merge.

Do not start R5. Do not merge from this editor. Do not self-approve.
