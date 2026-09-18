# STG-06 quote identity + register authority

Observer: WS3 senior / @wbdevworld
Task: STG-06 live quote product identity + false register/shift loss
Branch: `ws3/stg-06-quote-identity-register-authority`
Start SHA: `a02cd21875d0717adb6694d293b41575302b2415`
UTC: `2026-09-18`

Implementation SHA (pre-evidence): `5119054a2059ff5903a50d8b96644b63c38fdd48`.
Start `origin/main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`.
Originally declared batch at implementation: `4e47a1f793bb8b75f6cf4fa03ee8f66675b4a897`.
Freshness start/cutoff batch: `origin/batch/stg-01-staging-runtime-acceptance` = `a02cd21875d0717adb6694d293b41575302b2415`.
Classification: FRESH_2. Delivery: READY_FOR_INTEGRATION. Pass 3 not permitted. No merge.

## Defect 1 — quote product identity

`/api/pos/v1/catalog/sync` mapped Woo `sourceItemId` to opaque POS `itemId` and returned the page to the browser. It did not persist trusted-server rows in `public.pos_catalog_items`. Hosted staging therefore had zero projection rows. QuoteRequest sent provider-neutral POS IDs; the BFF forwarded them unchanged; the Woo bridge rejected them as non-Woo identifiers (`INTEGRATION_UNAVAILABLE`).

## Fix 1

- Catalog sync upserts rebuildable identity rows into `pos_catalog_items` with service-role only. Display prices are forced null; quote mapping never reads prices.
- Before the Woo quote bridge, every line `productId` / optional `variationId` is resolved POS `item_id` → `source_item_id` with `source_system=woocommerce`. Missing, tombstoned, wrong system, or ambiguous mappings fail closed.
- Woo quote line IDs are restored to the original POS IDs before the canonical Quote is returned or snapshotted.
- `CatalogItem.id` remains the opaque POS id. Sell UI contracts were not given `sourceItemId`. Woo remains pricing authority.

## Defect 2 — false register/shift loss

`loadRegister` cleared register and shift whenever `RegisterPort.get` or `activeShift` failed for a non-auth reason. A transient integration failure could show "No register" / "No open shift" while the staging shift stayed OPEN.

## Fix 2

Last-known verified register/shift is preserved on `INTEGRATION_UNAVAILABLE` / retryable failures, with an explicit degraded message. Authority clears only for assignment removed, authoritative `NOT_FOUND`, auth expiry/forbidden, sign-out/lock, or a successful `activeShift(null)`. Register-runtime no longer applies `null` shift from a failed refresh.

## Related tight-path fixes

- A. `quotesUrl()` normalizes site origin, `/wp-json/cetech-pos/v1`, and full `/quotes` without duplicating `wp-json`.
- B. `openShift` validates register/device before claiming idempotency, so pre-send device rejection does not leave a pending row.
- C. Register composition surfaces `session.message` on the open form and an alert; rejected open no longer looks like a silent dead button.
- D. Rebuild Catalog is observable (rebuilding / item count / failure+retry) and updates parent catalog availability without clearing cart/journal.

## Schema / contracts

- Schema changed: no. Existing `pos_catalog_items` used.
- Contracts changed: none.
- pgTAP: not rerun; no migration and no RLS change. Authenticated clients remain revoked on `pos_catalog_items`.

## Checks

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | PASS — 761 tests |
| `pnpm --dir apps/pos-web build` | PASS |
| `pnpm --dir apps/pos-web test:e2e` | PASS — 12 Playwright |
| `python scripts/verify_control_plane.py` | PASS |
| `git diff --check` | PASS (generated-fixture mutation from control-plane was reverted, not committed) |

## Remaining blockers

- This SHA is not on live Preview until imported and redeployed.
- Live catalog/quote still depends on BFF→WordPress service identity succeeding.
- `pricingParityVerified=false`; CP-04 / #4 open.
- Do not merge. Do not modify `main`. Do not start R9.

## ADR-012 / ADR-014 two-pass freshness (2026-09-18)

Kind: TASK_COMPLETION freshness. Pass 3 not permitted.

```text
START_FRESHNESS_SNAPSHOT UTC: 2026-09-18T12:21:46Z
Start main SHA: 778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5
Start batch ref/SHA: origin/batch/stg-01-staging-runtime-acceptance = a02cd21875d0717adb6694d293b41575302b2415
Pre-evidence implementation head: 5119054a2059ff5903a50d8b96644b63c38fdd48
Contracts: frozen v1.0.0 (docs/contracts/pos-domain.schema.json; unchanged vs origin/main)
ADRs: ADR-012 CURRENT; ADR-014 CURRENT human direction
Ownership / queue: WS3 @wbdevworld; STG-06 REMEDIATE; authorizer senior instruction 2026-09-18 in CURRENT-WORK.md

Pass 1 fetch UTC / success: 2026-09-18T12:22:03Z FETCH_OK
Pass 1 main SHA: 778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5
Pass 1 batch SHA: a02cd21875d0717adb6694d293b41575302b2415
scripts/check_upstream_drift.py --base 778348c --upstream origin/main --pass-number 1: History SAME, paths none
scripts/check_upstream_drift.py --base a02cd21 --upstream origin/batch --pass-number 1: History SAME, paths none
Authority inspection (AGENTS.md, SOURCE-OF-TRUTH.md, DECISION-REGISTER.md, contracts, OWNERSHIP.md, CURRENT-WORK.md, WS3 TASKS/STATUS/HANDOFF, CI): no Pass-1 arrivals vs start snapshot. origin/main vs this head still differs only on CURRENT-WORK.md, WS3 HANDOFF/STATUS, and historical .github/workflows/deploy-staging.yml from the already-consumed STG-01 batch (not a Pass-1 arrival).
Historical note vs originally declared implementation batch 4e47a1f: FORWARD to a02cd21 (60583d1 STG-02 persistence + a02cd21 docs correction). Already the parent of this branch. Classification COMPATIBLE. No reconcile.
Classification: FRESH_1, no STALE/CONFLICT/DECISION/UNSAFE.
Actions / reconciliation commits: none
Pass 1 tests at 5119054:
  python scripts/verify_control_plane.py PASS (generated fixture mutation reverted, not committed)
  git diff --check PASS
  pnpm --dir apps/pos-web lint PASS
  pnpm --dir apps/pos-web typecheck PASS
  pnpm --dir apps/pos-web test PASS 761
  pnpm --dir apps/pos-web build PASS
  pnpm --dir apps/pos-web test:e2e PASS 12 Playwright
Tested combination SHA: 5119054a2059ff5903a50d8b96644b63c38fdd48

Pass 2 fetch UTC / success: 2026-09-18T12:25:31Z FETCH_OK
Pass 2 main SHA: 778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5
Pass 2 batch SHA: a02cd21875d0717adb6694d293b41575302b2415
scripts/check_upstream_drift.py --base 778348c --upstream origin/main --pass-number 2: History SAME, paths none
scripts/check_upstream_drift.py --base a02cd21 --upstream origin/batch --pass-number 2: History SAME, paths none
Authority/contract files: unchanged since Pass 1.
Classification: FRESH_2, no arrivals, no reconcile.
Actions / reconciliation commits: none (this evidence commit only)
Pass 2 tests: not rerun; no upstream arrivals and no code change after Pass 1.

Final freshness status: FRESH_2
Delivery status: READY_FOR_INTEGRATION
Cutoff (Pass 2 tuple): main 778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5 ; batch a02cd21875d0717adb6694d293b41575302b2415 at 2026-09-18T12:25:31Z
Final task head SHA: recorded after this evidence commit (cannot be self-embedded)
Known post-cutoff risk: later origin/main or origin/batch movement is integration-editor / next-session input. Live Preview still needs import + redeploy. BFF→WordPress service identity still required for live quote. pricingParityVerified=false. CP-04 / #4 open.
Pass 3: NOT PERMITTED for this assignment.
Review/merge/release: do not merge; do not modify main; do not start R9.
```
