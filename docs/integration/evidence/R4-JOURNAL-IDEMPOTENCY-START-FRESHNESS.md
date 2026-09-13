# R4 OperationJournal idempotency continuation — start freshness

NEW ADR-012 continuation. Not Pass 3 of `R4-FRESHNESS.md`.

UTC: `2026-09-13T21:25:29Z`

Fetch: `git fetch origin --prune` succeeded from `C:\Users\Jane\Desktop\Learning 2026\Cursor\cetech-pwa-pos-r4-pr41`.

| Field | Exact value |
| --- | --- |
| origin/main | `516d6a49af74cc6677f67bdf843de6e819a05feb` (R3 PR #44 merge; no newer main) |
| PR #41 origin head | `76218ffaeb41c27eb568a2a27c461bbb70a14db8` |
| Assembled CORE-04/FE-03/FE-04 | intact on that head |
| Independent approval on a newer head | none. Reviews remain historical CHANGES_REQUESTED on `2700a37` / `a751017` by @wbdevworld |
| Required CI on `76218ff` | pull_request run 34783212290 success; push run 34783209556 success |
| Contract version | v1.0.0 unchanged (`ports.ts` blob `79339edb8b00de84ab82be4a68616e1e055e0f5e`) |
| ADR-012 | ACTIVE |
| Queue authorizer | Senior R4 journal-idempotency continuation 2026-09-13 |
| Issue #4 | OPEN |
| Issues #8, #9, #23 | OPEN |
| R5 | not started |

Declared integration baseline: existing PR #41 `ws1/fe-03-build-sell-cart-barcode-and-customer-workflow` at `76218ff…`. This continuation does not reopen CORE-04 architecture or contracts.

Scope: `OperationJournal` must treat same `(operation, idempotencyKey)` + different `requestHash` as `IDEMPOTENCY_CONFLICT` for every stored status, including `acknowledged`.
