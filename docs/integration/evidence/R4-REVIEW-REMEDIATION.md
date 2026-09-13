# R4 independent-review remediation (Emmanuel CHANGES_REQUESTED)

NEW ADR-012 continuation. Not Pass 3 of `R4-JOURNAL-IDEMPOTENCY-FRESHNESS.md`.
Start snapshot: `R4-REVIEW-REMEDIATION-START-FRESHNESS.md` UTC `2026-09-13T22:15:30Z`.

Reviewed head at assignment: `31bbfcccb6e0be6e944c12f4d580cc20ba7c69ad`
Pre-handoff implementation SHA: `3621c620dbab4e2ef245637fba4120c0ab346662`
Independent reviewer: @Emmanuel-coder-prog **CHANGES_REQUESTED** on that exact SHA (`2026-09-13T22:06:44Z`). That review is retained as history; it is not dismissed.
Base: `origin/main` `516d6a49af74cc6677f67bdf843de6e819a05feb`

Contracts: v1.0.0 consumed; **none changed**. Frozen QuoteRequest/Quote schema shape unchanged.
Issue #4: OPEN. `pricingParityVerified`: false. R5: **not started**. Production untouched.
Milestone delivery: **AWAITING INDEPENDENT RE-REVIEW** on the new exact head. Do not merge from this editor. Do not self-approve.

CORE-04 remains COMPLETE / INTEGRATED_AND_TESTED.
FE-03 remains RUNTIME COMPLETE / INTEGRATED_AND_TESTED.
FE-04 remains QUOTE-STATE INTEGRATION COMPLETE.

## Blocker 1 — Sell runtime initialization identity

`SellRuntimeScreen` created `defaultIdFactory("cart"|"line")` on every render when `PosApp` omitted optional id factories. Those identities were initialization-effect dependencies, so ordinary re-renders could restore catalog/customer/workspace again.

Fix: memoize fallback factories for the mounted lifetime. Keep catalog, customer, draft, location, recall/remember, and the **stable** id factories as genuine re-init dependencies (port replacement still reinitializes). `now` / `online` are mirrored through an effect-updated ref so going offline/online does not rerun restore. `PosApp` passes a `useCallback` online reader.

Mounted Playwright (`e2e/sell-runtime.spec.ts`):

1. Sell heading visible; `data-sell-restore-count="1"`; “Loading catalog…” gone.
2. Scan `0012345678901` → Epoxy Hardener 1L qty 1.
3. Increase quantity → qty 2.
4. Restore count stays `1`; qty stays 2; restore UI does not return.
5. Reload still shows qty 2 from the retained draft (not overwritten by a second init).

## Blocker 2 — live `changed` quote state

`requestWholeCartQuote()` already returns `changed` for same-revision fingerprint drift after a confirmed quote. The hook always passed `{ status: "missing" }`.

Fix: `remote` remains render state; `remoteRef` holds the last committed remote quote and is not an effect dependency. Same-cart + same-revision confirmed state is passed into `requestWholeCartQuote()`. Different cart identity/revision compares as `missing` (no false `changed`). Coming back online increments an epoch during render so the UI is `quoting` (checkout `allowed=false`, reason `QUOTE_REQUIRED`) before the in-flight response; it does not stay payment-eligible on the older confirmed quote. Same fingerprint → `confirmed`; different fingerprint → `changed` (Pay remains disabled). Delayed older revision still cannot replace a newer committed revision.

Mounted Playwright (`e2e/sell-runtime.spec.ts`):

1. Revision N confirmed with fingerprint A / GHS 15.00.
2. Offline → `offline`, eligibility `CONNECTION_REQUIRED`, Pay disabled.
3. Same revision returns online → `quoting`, eligibility `QUOTE_REQUIRED`, Pay disabled.
4. Adapter returns fingerprint B / GHS 18.00 → `changed`; previous A, current B; eligibility `allowed=false` / `QUOTE_REQUIRED`; Pay disabled.

Helper/unit coverage in `tests/frontend/sell-quote-runtime.test.ts` still covers delayed older revision, customer/revision requote, expired/offline/failed payment blocks, plus previous-confirmed selection that refuses a different cart or revision.

No frontend pricing calculations were added. Quotes are adapter/BFF responses.

## Blocker 3 — catalog cursor last-returned semantics

`nextCursor` was `candidates[limit]` (first not returned). The next page used `id > cursor`, which skipped that item.

Fix: cursor is the last item already returned. Deterministic ID order preserved. No offset pagination.

Vitest (`tests/integration/sync/catalog-projection.test.ts`):

- 5 ordered items, `limit=2`: pages [a,b], [c,d], [e]; every id once; no skip/duplicate; final page has no `nextCursor`.
- Filtered `query: "Adhesive"` and `parentId` walks use the same last-returned rule.

## Files

- `apps/pos-web/src/features/sell/runtime/SellRuntimeScreen.tsx`
- `apps/pos-web/src/features/sell/runtime/useCartQuote.ts`
- `apps/pos-web/src/app/pos-app.tsx`
- `apps/pos-web/src/core/catalog/engine.ts`
- `apps/pos-web/e2e/sell-runtime.spec.ts`
- `tests/frontend/sell-quote-runtime.test.ts`
- `tests/integration/sync/catalog-projection.test.ts`
- this evidence / STATUS / HANDOFF / CURRENT-WORK

## PRE-R5 HARDENING (not implemented in this continuation)

### PRE-R5 HARDENING — catalog query/index performance

`createLocalCatalogPort.search()` (`apps/pos-web/src/local/catalog-repository.ts`) calls `loadCatalogEngine()` on every search, including typed queries and barcode lookups. That reads the full IndexedDB catalog and reconstructs `CatalogProjectionEngine` per call (cashier seed is small; CORE-04 fixture is 5,000 items).

Suggested direction (benchmark before/after; do not silently redesign here): persistent Dexie indexes / targeted queries; avoid full-catalog reconstruction per keystroke/scan.

Not required for correctness of the three blockers.

### PRE-R5 HARDENING — QuoteRequest/Quote runtime schema validation

`handleQuote` / `parseQuoteRequest` (`apps/pos-web/src/server/quotes/handle-quote.ts`) checks UUID cartId, non-negative revision, locationId string, customer object, and non-empty lines, then casts to `QuoteRequest`. Bridge composition is similarly shallow versus the repository JSON Schema policy.

Do not change frozen v1 schema shape here. Bounded architecture/security pass before effectful sale preparation relies on this boundary.

Not required for correctness of the three blockers.

## Combined-tree commands (Node 24.21.0, pnpm 12.4.1)

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
| frozen install | PASS |
| lint | PASS |
| typecheck | PASS |
| Vitest | **42 files / 236 tests PASS** (do not reuse 232) |
| production build | PASS |
| App E2E | **3 passed** (`scaffold.spec.ts` + two `sell-runtime.spec.ts` regressions) |
| Isolated visual Playwright | **12 passed** (PNG harness output restored; not committed) |
| `git diff --check` | clean |

New regressions inside 236 + E2E 3:

| Proof | Where |
| --- | --- |
| one-time mounted initialization | E2E `data-sell-restore-count="1"` after ready |
| cart changes do not restore workspace | E2E qty 2 + restore count stays 1; reload keeps qty 2 |
| confirmed A → same-revision revalidation → fingerprint B → changed | E2E `data-quote-status=changed` previous GHS 15.00 / current GHS 18.00 |
| checkout blocked during revalidation | E2E `quoting` + `data-eligibility-allowed=false` / `QUOTE_REQUIRED` |
| checkout blocked in changed | E2E `changed` + `allowed=false` / `QUOTE_REQUIRED`; Pay disabled |
| complete cursor traversal with no skip/duplicate | Vitest 5 items limit 2 + filtered search/parentId |

Independent reviewer for the new head: **@Emmanuel-coder-prog** (PR author @Ben-001-sys cannot satisfy independent GitHub approval). Assembling editor will not self-approve, dismiss the prior review, merge, or start R5.
