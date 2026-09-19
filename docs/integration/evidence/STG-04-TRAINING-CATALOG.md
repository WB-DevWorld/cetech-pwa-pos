# STG-04 training Woo catalog projection

Kind: TASK_COMPLETION evidence (WS3). Not live catalog PASS on training and not a commercial sale.

- Task: STG-04 / issue #73
- Parent: STG-01 / #70
- Owner: @wbdevworld / WS3
- Branch: `ws3/stg-04-training-catalog-projection`
- Start SHA: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5`
- STG-05 producer consumed (not cherry-picked): `4d549167f7d6dcecf0eff24f35e1f24a3429d3d8`
- STG-02 isolated (not imported): `8a6aba2ce82ebe265a154f89999c2caab7a08beb`
- Contracts: **NONE** (CatalogPort v1.0.0 consumed)
- Dexie schema: unchanged v4; catalog rebuildable; drafts/journal retained
- `pricingParityVerified`: **false**

This is contributor-branch evidence. It does not close #73, #70, #25, #54, or #4. It does not authorize production mutation.

## Catalog source policy

| Runtime | Behavior |
| --- | --- |
| local / test / demo (`APP_ENV` unset, `local`, `test`, `demo`; browser localhost) | Synthetic cashier seed **may** be used when the producer is missing |
| staging / production-intent | Provider-derived projection only. Never seed Epoxy Hardener / Steel Conduit / Armoured Cable. Leftover synthetic IndexedDB is cleared (catalog stores only) |

## BFF

`GET /api/pos/v1/catalog/sync?cursor&limit&modifiedAfter`

- Staff session required (same cookie as health/quotes). CSRF not required (GET).
- Server adapter calls `GET /wp-json/cetech-pos/v1/catalog` with BFF-held `BRIDGE_USERNAME` / `BRIDGE_APPLICATION_PASSWORD`.
- Browser never receives those credentials or WP/Woo privileged secrets.
- Producer `rest_no_route` / missing bridge → `INTEGRATION_UNAVAILABLE` ("catalog producer is unavailable").

## Mapping

| Source | POS projection |
| --- | --- |
| Woo `sourceItemId` | source identity only |
| `posItemId` | opaque UUID v5(`woocommerce:{sourceItemId}`) in namespace `8c2e9b10-7f3a-51d4-9c6e-a1b2c3d4e5f6` |
| `sourceParentId` | `parentId` = UUID v5 of the parent Woo id (stable even if parent row is not in the current page) |
| SKU / barcodes | strings via `preserveBarcode`; leading zeroes survive |
| `deleted` | tombstone; barcodes unindexed |
| `sourceVersion` / `sourceUpdatedAt` | persisted on the projection row |
| prices / `posItemId` from catalog DTO | **never copied**; quote-time `POST /quotes` remains authority |

## Sync behavior

- Bootstrap: inspect local projection → paginate BFF (`limit` 200) → rebuild IndexedDB catalog stores only.
- Incremental reconnect: `modifiedAfter` watermark; do not re-download the full catalog when a watermark exists.
- Reconnect/focus/online: throttled (`5m`). Search/scan stay on local `CatalogPort` and do not call the bridge per query.
- Refresh failure with a usable **provider** projection: `stale` / degraded; cart edits still allowed; do not claim fresh stock/pricing.
- No usable provider projection in staging: `unavailable` / synchronization required.
- Cart drafts, journal, auth/session, and unrelated Dexie stores are not cleared.

## Checks (local)

| Command | Result |
| --- | --- |
| `python scripts/verify_control_plane.py` | PASS |
| `pnpm --dir apps/pos-web lint` | PASS |
| `pnpm --dir apps/pos-web typecheck` | PASS |
| `pnpm --dir apps/pos-web test` | **76 files / 700 tests PASS** |
| focused catalog/sync tests | **30 passed** |
| `pnpm --dir apps/pos-web test:e2e` | **9 passed** |
| `git diff --check` | PASS |
| Supabase/pgTAP | not required (no `supabase/**` changes) |

## Remaining blockers

- Training must be deployed with plugin `0.6.0-stg05` before a live catalog page can exist (`BLOCKED_TRAINING_PLUGIN_NOT_DEPLOYED_STG05`).
- STG-02 session composition is not on this branch; authenticated staging catalog sync waits on later STG-01 assembly.
- Issue #4 remains OPEN. `pricingParityVerified` remains false.

Freshness: Pass 1 and Pass 2 both observed `origin/main` `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` (no drift). Status **FRESH_2**. Pass 3 not permitted.

No customer PII. No secrets printed or committed. No live electronic payment. No production mutation. No refund/restock.
