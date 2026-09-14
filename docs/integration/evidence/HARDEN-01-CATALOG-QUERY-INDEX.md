# HARDEN-01 catalog query/index evidence

Task: HARDEN-01 / issue **#46**. PRE-R5 hardening, not R5. Contributor branch `ws3/pre-r5-catalog-query-index` from `origin/main` `29cea52acbee2729175df61d2ae1a6658c5c04b1`.

Pre-handoff implementation SHA: `1199a344a3d2bf4d24b0322ca29f04ad6711cb63`

Declared owner / acting implementer: @wbdevworld / WS3. Mode: IMPLEMENT. Reassignment: NONE.

This file is the task-specific STATUS/HANDOFF/evidence surface. Shared `CURRENT-WORK.md`, `docs/workstreams/WS-03-CORE-DATA-INTEGRATION/STATUS.md`, and `HANDOFF.md` were **not** edited (parallel PRE-R5 contributor). The WS3 integration editor should import this SHA into `batch/pre-r5-hardening` / PR **#51** and reconcile those shared files afterward. Do not treat this file as permission to start BR-06, CORE-05, #47, or #48.

`pricingParityVerified` remains false. Issue #4 remains OPEN. No sale/payment/order effects. Catalog remains a rebuildable local/read-model, not inventory truth. IndexedDB drafts/journal were not cleared.

## Architectural change

R4 `createLocalCatalogPort.search()` called `loadCatalogEngine()` on every typed search and barcode scan. That path did `catalogItems.toArray()` and reconstructed `CatalogProjectionEngine` per request.

HARDEN-01 routes `CatalogPort.search` through `searchLocalCatalog()`:

| Lookup | Indexed path | Rows loaded on the 5,000-item fixture |
| --- | --- | --- |
| Exact / duplicate / missing barcode | Dexie `barcodeIndex` + `bulkGet` of those ids | 1 unique / 2 duplicate / 0 missing object rows |
| `productId` | primary key `get` | 1 |
| `parentId` / variations | `parentId` index | 2 children in the fixture |
| Typed name/SKU/barcode substring | persistent multi-entry `searchGrams` (Dexie v4), then R4 haystack/barcode predicates | 16 object rows for `bulk item 1234` (not 5000) |
| Browse / empty query | id-ordered cursor until page fill | first page of 50 loaded fewer than 100 rows |

`CatalogProjectionEngine` remains the rebuild/incremental projection owner. Local Dexie schema v4 adds `*searchGrams` and backfills grams on upgrade without deleting cart drafts or the journal. Domain/contract v1.0.0 unchanged. No Supabase migration.

## 5,000-item real local-adapter benchmark

Synthetic non-PII fixture `tests/integration/sync/fixtures/synthetic-catalog.ts`. Workstation: Windows, Node **24.21.0**, Vitest 5.0.0, `fake-indexeddb`. Not a production device claim.

Before = R4 hot path (`loadCatalogEngine` + in-memory `engine.search`) on the **same** persisted Dexie catalog. After = `searchLocalCatalog`.

| Operation | Before (full table + engine reconstruct) | After (indexed local adapter) | Indexed path |
| --- | --- | --- | --- |
| Name search `bulk item 1234` | **133.79 ms**; hit `item-0001234` | **5.25 ms**; same id; **16** catalog rows; `engineReconstructed=false` | `searchGrams` |
| Exact barcode `0001234567890` | **125.33 ms**; unique `item-0000001` | **0.50 ms**; **1** barcode-index row + **1** catalog row | `barcode` |
| Duplicate barcode `DUP000000001` | **113.41 ms**; ids `item-0000002`, `item-0000003` | **0.34 ms**; **2** catalog rows | `barcode` |
| Parent/variation lookup `parentId=item-0000005` | **171.31 ms**; children `item-0000006`, `item-0000007` | **0.37 ms**; **2** catalog rows | `parentId` |

Vitest also asserted: `catalogItems.toArray` and `CatalogProjectionEngine.replaceSnapshot` are **not** called on the after path; leading-zero barcode string preserved; missing barcode empty; variation barcode `VAR000000042` unique with parent; incremental tombstone hides `item-0000008` / `TOM000000001`; browse `limit=50` uses `idCursor` and matches engine page ids; Dexie v3→v4 upgrade fills grams and keeps cart revision 4.

Do not treat these milliseconds as production scale. The acceptance bar is architectural: a normal lookup no longer loads every row or rebuilds the full engine.

## Commands

```text
python scripts/verify_control_plane.py
pnpm --dir apps/pos-web lint
pnpm --dir apps/pos-web typecheck
pnpm --dir apps/pos-web test
pnpm --dir apps/pos-web exec vitest run ../../tests/integration/sync/catalog-query-index.test.ts --reporter=verbose
git diff --check
```

| Command | Result |
| --- | --- |
| control-plane | PASS (3 workstream packages, 30 scoped tasks/DAG, 28 immutable reference files, 61 schemas, 22 contract fixtures) |
| lint | PASS |
| typecheck | PASS |
| Vitest | **44 files / 247 tests PASS** |
| HARDEN-01 adapter/benchmark | **3 passed** (5,000-item indexed path, cursor walk, v3→v4 draft-preserving upgrade) |
| `git diff --check` | clean |

## Handoff (TASK_COMPLETION)

Kind / UTC: TASK_COMPLETION / 2026-09-14T01:15:46Z (Pass-2 cutoff; no Pass 3)
Task / batch / workstream: HARDEN-01 / issue #46 / PRE-R5 / WS3
Owner / integration editor / requested human reviewer: @wbdevworld / WS3 integration editor for PR #51 / independent reviewer on the milestone PR (do not self-approve; do not merge)
Branch: `ws3/pre-r5-catalog-query-index`
Starting/base SHA: `origin/main` `29cea52acbee2729175df61d2ae1a6658c5c04b1`
Pre-handoff implementation SHA: `1199a344a3d2bf4d24b0322ca29f04ad6711cb63`
Allowed paths used: `apps/pos-web/src/local/**`, `apps/pos-web/src/core/catalog/**` (query helpers only), `tests/integration/sync/**`, this evidence file
Forbidden preserved: WS1 features/ui/frontend tests; WS2 bridge; contract/schema version; inventory ownership; BR-06/CORE-05; `CURRENT-WORK.md`; shared WS3 STATUS/HANDOFF; `batch/pre-r5-hardening`
Contracts changed: none (v1.0.0 consumed)
Database migrations: none (Dexie local schema **v4** only; drafts/journal retained)
Architecture decisions: none
Completed: #46 indexed local catalog query
Remaining: integration editor imports this SHA into PR #51; HARDEN-02 (#47) is a **separate** contributor branch; do not start #48 or R5 from this task
Dependencies: CORE-04 on main ACCEPTED; this SHA is the HARDEN-01 source for PROVISIONAL_TEST import
Tests: table above
Runtime verification: synthetic Dexie/`fake-indexeddb` only; no live Woo/inventory
Remote effects intended after evidence commit: `git push` of this contributor branch only
Assumptions / limitations: grams are a candidate filter; final match still uses R4 haystack/barcode predicates; persist/rebuild still rewrites the local catalog snapshot (not the query hot path)
Unresolved risks: none for this gate; integration-editor follow-up is import + shared ledger reconcile
Next exact action for receiving owner: cherry-pick/import `1199a344a3d2bf4d24b0322ca29f04ad6711cb63` (and the follow-up evidence commit) into `batch/pre-r5-hardening`; do not merge this contributor branch to main; do not self-import into PR #51 from this task

## Integration-editor STATUS/HANDOFF snippet (not applied here)

Suggested shared STATUS line: HARDEN-01 IMPLEMENTATION COMPLETE on `ws3/pre-r5-catalog-query-index` source SHA `1199a344a3d2bf4d24b0322ca29f04ad6711cb63`; 5,000-item Dexie adapter evidenced; waiting import into PR #51.

Suggested CURRENT-WORK row (editor only): HARDEN-01 / @wbdevworld / WS3 / `ws3/pre-r5-catalog-query-index` / READY_FOR_INTEGRATION / source `1199a34…`.

## Freshness protocol

START_FRESHNESS_SNAPSHOT UTC: `2026-09-14T01:06:07Z`
Start main SHA: `29cea52acbee2729175df61d2ae1a6658c5c04b1`
Start batch ref/SHA: `origin/batch/pre-r5-hardening` `864e68a36c3bc3a32f571f57ecd73da14d77d7af` (observed only; not modified)
Applicable contracts / ADRs / ownership / queue revision: CatalogPort v1.0.0; ADR-014; HARDEN-01 issue #46

Pass 1 fetch UTC / success evidence: `2026-09-14T01:15:19Z` `git fetch origin --prune` succeeded
Pass 1 main SHA: `29cea52acbee2729175df61d2ae1a6658c5c04b1` SAME
Pass 1 batch SHA: `864e68a36c3bc3a32f571f57ecd73da14d77d7af` SAME
Classification: none
Actions / tests rerun: none required

Pass 2 fetch UTC / success evidence: `2026-09-14T01:15:46Z` independent `git fetch origin --prune` succeeded
Pass 2 main SHA: `29cea52acbee2729175df61d2ae1a6658c5c04b1` SAME
Pass 2 batch SHA: `864e68a36c3bc3a32f571f57ecd73da14d77d7af` SAME
Classification: none
Actions / tests rerun: none required

Final freshness status: **FRESH_2**
Delivery status: **READY_FOR_INTEGRATION** (contributor source only; not imported, not merged)
Known post-cutoff risk / integration editor follow-up: later main or `batch/pre-r5-hardening` movement; parallel HARDEN-02 must stay on its own branch
Pass 3: NOT PERMITTED for this assignment.
Review/merge/release status and limitations: no self-merge; no import into PR #51 by this task; no production promotion
Metrics delta for CURRENT-WORK: Pass-1/Pass-2 stale findings 0/0; both cutoffs `29cea52…` / `864e68a…`. Other PRE-R5 metrics UNVERIFIED. Editor should copy counts; this task did not write CURRENT-WORK.
