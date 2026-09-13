# CORE-04 acceptance evidence

Task: CORE-04 / issue #23. Isolated branch `ws3/core-04-implement-catalog-projection-and-durable-loca` from `origin/main` `516d6a49af74cc6677f67bdf843de6e819a05feb`. Implementation SHA `73b3fd9fbe6028dc1cd5eec9b21945c987882886`.

This is not R4 complete. `pricingParityVerified` remains false. Issue #4 remains OPEN. No sale/payment effects.

## 5,000-item catalog projection benchmark

Synthetic non-PII fixture `tests/integration/sync/fixtures/synthetic-catalog.ts`. No production catalog copy.

Workstation: Windows, Node **24.21.0**, Vitest 5.0.0, in-process `CatalogProjectionEngine` (not a production hardware/device claim).

| Operation | Result |
| --- | --- |
| Fixture size | **5000** source records |
| Initial rebuild | 5000 live items, **18.14 ms** |
| Search (`bulk item 1234`) | hit `item-0001234`, **4.35 ms** |
| Exact barcode lookup (leading-zero `0001234567890`) | unique, **0.10 ms** |
| Duplicate barcode `DUP000000001` | explicit `duplicate` (two POS ids) |
| Missing barcode `NO-SUCH-BARCODE` | explicit `missing` |
| Exact variation barcode `VAR000000042` | unique variation `item-0000006` with parent `item-0000005` |
| Incremental tombstone | live count **4999**; tombstoned id removed from search and barcode index |

Do not treat these milliseconds as production scale, multi-device, or live Woo sync proof.

## Other acceptance

| Criterion | Evidence |
| --- | --- |
| Leading-zero barcode preserved as string | unique lookup returns `0001234567890`; SQL comment + pgTAP sku assertion |
| Exact variation resolves | parentId search returns both children; barcode bypasses chooser at CatalogPort |
| Tombstone removes stale entry | incremental delete; `get`/`search`/`lookupBarcode` empty |
| Projection rebuild preserves cart drafts | Dexie cart remains revision 3 / qty `2` after catalog rebuild |
| Reload preserves unacked journal | close/reopen IndexedDB; pending row + payload retained |
| Schema upgrade does not erase drafts/journal | Dexie v2 → v3 adds `rebuildTokens`; cart revision 9 and journal count 1 remain; catalog may be cleared |
| No privileged secret in journal | payload with `SUPABASE_SERVICE_ROLE_KEY` rejected |
| No production/customer PII fixture | generated `Synthetic …` labels only |

## Commands (CORE-04 worktree)

```text
python scripts/verify_control_plane.py
python -m unittest discover -s tests/tooling -v
pnpm --dir apps/pos-web lint
pnpm --dir apps/pos-web typecheck
pnpm --dir apps/pos-web test
git diff --check
```

Results: control-plane PASS; tooling **48 tests OK**; lint PASS; typecheck PASS; Vitest **36 files / 210 tests PASS**; `git diff --check` clean.

Local Supabase `db reset` / pgTAP was not executed in this worktree (no implied local Docker). Catalog RLS assertions are in the mirrored pgTAP suite for CI `supabase test db`.
