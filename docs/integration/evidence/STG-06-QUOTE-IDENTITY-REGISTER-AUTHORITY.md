# STG-06 quote identity + register authority

Observer: WS3 senior / @wbdevworld
Task: STG-06 live quote product identity + false register/shift loss
Branch: `ws3/stg-06-quote-identity-register-authority`
Start SHA: `a02cd21875d0717adb6694d293b41575302b2415`
UTC: `2026-09-18`

Start `origin/main`: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`.
Start batch `origin/batch/stg-01-staging-runtime-acceptance`: `4e47a1f793bb8b75f6cf4fa03ee8f66675b4a897`.
Classification at implementation: IRRELEVANT / COMPATIBLE for this contributor lane. Freshness two-pass not completed in this session (UNVERIFIED for final protocol). No merge.

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
