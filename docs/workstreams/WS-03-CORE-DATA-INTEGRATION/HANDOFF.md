# WS3 current handoff — REC-01 receipt product-name / SKU

Kind: TASK_COMPLETION. UTC: 2026-09-18T14:10:00Z (pre-freshness implementation close; freshness fields filled after Pass 2).

Task / batch / workstream: REC-01 / WS3 contributor branch (not a milestone PR).
Owner / integration editor / requested human reviewer: `@wbdevworld` / WS3. Independent human review required before merge. WS1 consumer: `@Ben-001-sys` after this head is published. This agent does not approve, merge, or dismiss reviews.
Mode: IMPLEMENT.
PR: none. Do not merge main. Do not deploy production.

Branch: `ws3/receipt-product-name-sku`
Starting/base SHA: `778348c0bcf2f3cef5280cf6cf7a1d057aa8f9e5` (`origin/main` R8 #69)
Current/final task head SHA: recorded after the implementation commit (cannot be self-referential in this file’s first commit)
Allowed / forbidden paths and central leases: WS3 contracts, `apps/pos-web/src/core/**`, `apps/pos-web/src/server/**`, `apps/pos-web/src/app/api/**`, `supabase/**`, `docs/**`, `tests/contracts/**`. Forbidden: WS1 `ProductSearch.tsx` / `sell.css` / cart presentation; WS2 plugin; production deploy.
Files changed: listed in git commit; core receipt helpers, prepare wiring, additive `pos_receipt_settings` migration, ADR-016, fixtures.
Contracts changed: v1.0.0 additive. `ReceiptLine.displayName?`, `ReceiptLine.sku?`; new `ReceiptSettings`. Quote/Prepare/Payment unchanged. `domain.generated.ts` regenerated from canonical JSON schema.
Database migrations: `20260918140000_pos_receipt_settings.sql` (additive). Applied on **local** Docker `supabase_db_cetech-pwa-pos` / database `postgres`. **Remote staging UNVERIFIED. Production not touched.**
Architecture decisions: ADR-016.

## Defect confirmed on main

`receiptLinesFromQuote` on `778348c…` mapped `name <- productId` and `variationLabel <- variationId`. REC-01 does not wrap truncation around that mapping. Prepare now joins `pos_catalog_items` presentation (name, sku, variation_label, kind, parent) at sale time and fails closed with `INTEGRATION_UNAVAILABLE` if presentation is missing.

## Receipt settings defaults

| Field | Default | Bounds |
| --- | --- | --- |
| `shortenProductNames` | `false` | boolean |
| `productNameMaxCharacters` | `40` | integer 1–256 |
| `showSku` | `false` | boolean |

Missing `pos_receipt_settings` row means those defaults. Shortening defaults OFF.

## Examples (synthetic; not live customer data)

- Full sale-time name: `Armoured Cable 4-Core 25mm Copper Conductor`
- Frozen shortened `displayName` at max 18: `Armoured Cable 4-…` (Unicode ellipsis U+2026; 18 code points including ellipsis)
- Variation SKU `CBL-ARM-RED` overrides parent `CBL-ARM`
- Missing variation SKU falls back to parent SKU
- `showSku=false` or empty SKU: field omitted

## Local DB evidence (not remote staging)

Environment: local Docker Postgres `supabase_db_cetech-pwa-pos`, not production. That stack already contained extra versions `20260915223000` and `20260917140000` (shared local R9 stack) before this additive apply.
- Pre-migration historic receipt snapshot md5: `2f61331f167796e1d4dc78fb6f2bf64f` (legacy line had `name`, no `displayName`/`sku`)
- After `20260918140000` apply: same hash
- After inserting loc_a1 settings `shorten=true`, max 18, `showSku=true`: same hash
- pgTAP `supabase/tests/receipt_settings.sql`: 9/9 ok (BEGIN/ROLLBACK)
- `npx supabase db reset` was **not** used (Windows CLI quoting failure). Direct `psql` apply only.
- No second training commercial sale. No remote Supabase project apply. No production.

## Tests executed (local)

- `pnpm --dir apps/pos-web lint` PASS
- `pnpm --dir apps/pos-web typecheck` PASS
- `pnpm --dir apps/pos-web test` PASS — 76 files / 699 tests
- `pnpm --dir apps/pos-web build` PASS
- `python scripts/verify_control_plane.py` PASS (82 schemas, 68 fixtures)
- `python -m unittest discover -s tests/tooling -v` PASS — 48 OK
- Local pgTAP receipt settings 9/9 PASS

Remote effects performed: none (no Paystack, no Woo sale/refund, no production, no VitePOS change).

## WS1 handoff — fields Ben may consume

Do **not** start compact POS two-line wrapping in this foundation. Do **not** reuse `formatReceiptDisplayName` on catalog, search, cart, or Woo payloads.

Receipt paper / reprint should read the stored snapshot:

- `line.name` — full sale-time product name (never a product/variation id)
- `line.displayName` — frozen printable name written on new receipts; historic receipts may omit it
- Render printable name as `line.displayName ?? line.name`
- `line.sku?` — frozen effective SKU; omit in UI when absent
- `line.variationLabel?` — sale-time variation label, never a variation id
- Existing quantity/pricing/tax fields unchanged

There is no cashier HTTP settings API yet. Settings persist in `pos_receipt_settings` and are read at prepare. A later WS1/admin task can expose upsert.

## Remaining / not done

- Compact POS two-line UI: WS1, out of scope
- Remote staging migration/sale/reprint: UNVERIFIED
- Milestone PR / merge / production deploy: NOT AUTHORIZED
- Unrelated untracked `doc/` preserved, not committed

## Next exact action

Publish this contributor branch for independent review. Hand `ReceiptLine` fields above to Ben/WS1. Do not merge main. Do not deploy production. ADR-012 Pass 1 + Pass 2 only after the implementation commit; then STOP.

Pass 3: NOT PERMITTED.
Production promotion: NOT AUTHORIZED.
Live electronic payment / live refund/restock: NOT AUTHORIZED.
Merge to main: NOT AUTHORIZED.
