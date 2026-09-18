# WS3 current handoff — REC-01 receipt product-name / SKU

Kind: TASK_COMPLETION. UTC: 2026-09-18T17:10:00Z (review remediation close; freshness fields filled after Pass 2 if run).

Task / batch / workstream: REC-01 / WS3 contributor branch PR #80 (not a milestone merge).
Owner / integration editor / requested human reviewer: `@wbdevworld` / WS3. Independent human review required before merge. This agent does not approve, merge, or dismiss reviews.
Mode: IMPLEMENT.
PR: #80. Do not merge main. Do not deploy production.

Branch: `ws3/receipt-product-name-sku`
Starting/base SHA: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` (`origin/main` R8 #69)
Review-remediation starting HEAD: `f9c7c2a415823a8911435e56ce650a00e1ef0b7b`
Current/final task head SHA: recorded after the remediation commit (cannot be self-referential in this file)
Allowed / forbidden paths and central leases: WS3 contracts, `apps/pos-web/src/core/**`, `apps/pos-web/src/server/**`, `apps/pos-web/src/app/api/**`, `supabase/**`, `docs/**`, `tests/contracts/**`, `tests/integration/**`. Forbidden: WS1 `ProductSearch.tsx` / `sell.css` / cart presentation; WS2 plugin; production deploy.
Files changed: durable `intent_snapshot` journal field, prepare append-before-send, variation parent fail-closed, tests, ADR-016.
Contracts changed: v1.0.0 additive unchanged this remediation (`ReceiptLine.displayName?`/`sku?`, `ReceiptSettings` already on the branch).
Database migrations: `20260918140000_pos_receipt_settings.sql` (pending shared-staging). **New** `20260918150000_pos_prepare_intent_snapshot.sql` (additive `pos_pending_operations.intent_snapshot jsonb`). Applied on **local** Docker `supabase_db_cetech-pwa-pos` only. **Remote staging UNVERIFIED / not applied from this work. Production not touched.**
Architecture decisions: ADR-016 updated for durable pre-commercial intent and mandatory variation parent presentation.

## Review blockers closed

1. Sale-time presentation is bound to the existing `sale.prepare` `pos_pending_operations` row as `intent_snapshot` **before** `SalesPort.prepare`. Recovery loads that exact intent after `SalesPort.resolve`. It does not re-read catalog. Missing intent fails `REQUIRES_ATTENTION`. Intent write failure does not call `SalesPort.prepare`.
2. Quoted variations require parent catalog presentation. Missing parent is `INTEGRATION_UNAVAILABLE` with prepare count 0. Variation SKU still wins; blank variation + parent SKU uses parent; both blank omits SKU legitimately.

## Durable prepare-intent design

- Column: `pos_pending_operations.intent_snapshot jsonb` (not `outcome`).
- Kind: `sale.prepare.presentation`.
- Bound to organization + operation=`sale.prepare` + idempotency key + request hash + transaction scope.
- Append-once: later binds return the original capture.
- Contains quote id/fingerprint, transaction id, line ids, full sale-time name, variation label, effective SKU, quote-derived line economics.
- Not a fabricated `PreparedSale`.

## Append-before-send order

1. validate quote/register/shift/device/scope
2. claim/bind idempotency
3. load/validate sale presentation, or reuse existing intent
4. durably persist/bind `intent_snapshot`
5. mark sent, then `SalesPort.prepare`
6. validate commercial response
7. persist `PosSaleRecord` from the exact durable intent
8. acknowledge idempotency

## Receipt settings defaults

| Field | Default | Bounds |
| --- | --- | --- |
| `shortenProductNames` | `false` | boolean |
| `productNameMaxCharacters` | `40` | integer 1–256 |
| `showSku` | `false` | boolean |

Missing `pos_receipt_settings` row means those defaults. Shortening defaults OFF.

## Tests executed (local)

- `pnpm --dir apps/pos-web lint` PASS
- `pnpm --dir apps/pos-web typecheck` PASS
- `pnpm --dir apps/pos-web test` PASS — 76 files / 712 tests
- `pnpm --dir apps/pos-web build` PASS
- `python scripts/verify_control_plane.py` PASS (82 schemas, 68 fixtures)
- `python -m unittest discover -s tests/tooling -v` PASS — 48 OK
- Local pgTAP `supabase/tests/prepare_intent_snapshot.sql`: 6/6 ok (BEGIN/ROLLBACK)
- Local Docker additive apply of `20260918150000` only. No remote staging apply. No production.

Remote effects performed: none (no Paystack, no Woo sale/refund, no production, no VitePOS change).

## Remaining / not done

- Compact POS two-line UI: WS1, out of scope
- Remote staging migration/sale/reprint for `20260918140000` and `20260918150000`: UNVERIFIED / senior shared-staging verification
- Milestone PR / merge / production deploy: NOT AUTHORIZED
- Unrelated untracked `doc/` preserved, not committed

## Next exact action

Independent review of PR #80. Do not merge. Do not deploy production. Human senior applies shared-staging migrations when ready.

Pass 3: NOT PERMITTED.
Production promotion: NOT AUTHORIZED.
Live electronic payment / live refund/restock: NOT AUTHORIZED.
Merge to main: NOT AUTHORIZED.
