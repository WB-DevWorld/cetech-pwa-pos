# Staging execution record — prepare for release decision (source tip pending pin)

Production effects: **NONE** in this source batch. This record is the concrete package for the owner's separately authorized hosted apply + Preview. It does **not** authorize those actions.

## Source candidate

- Branch: `ws3/combined-candidate-2026-10-08`
- PR: #144
- Final tip: _(pinned at publish)_
- Reviewed base for this gate batch: `22035a513e43b896cbc5e96964aa428b71d8d010`
- Tester remains: `dpl_F3uXpLZA7xrkTb5av4TNzDc3ZGry` / BUILD_ID `452c446` until identity-proved Preview after apply

## Proposed migration order (NOT hosted-applied)

| Order | Source version | Purpose |
| --- | --- | --- |
| 1 | `20261009130000_pos_sale_tender_claims.sql` | claim table |
| 2 | `20261009130100_pos_sale_tender_claim_atomic_cash.sql` | atomic cash RPC |
| 3 | `20261009140000_db_sec_02_03_cash_authz.sql` | cash authz / disablement |
| 4 | `20261009150000_pos_sale_tender_write_boundary.sql` | write-boundary guards + shift disablement |
| 5 | `20261009160000_pos_sale_tender_evidence_enrollment.sql` | adopt retained evidence + backfill claims |

**RD-01 mapping preserved:** hosted `20261008151307` ↔ source `20261006025100_db_sec_01_revoke_authenticated_truncate.sql`. Never re-apply or bulk-push RD-01.

## Legacy mutation barrier / enrollment plan

Route A (implemented in source): `pos_claim_or_require_tender_family` locks payment/cash rows, infers retained tender evidence, conflicts opposite family, then inserts claim. Migration also backfills claims from unambiguous payment/cash_sale rows.

Release sequence recommendation:
1. Backup/restore prerequisites confirmed for staging project `iegxncvpsyaitkpzywcr`.
2. Apply migrations 1→5 in order against staging (no bulk folder push that includes RD-01).
3. Verification queries (read-only then targeted):
   - claim table exists; helper/guard functions present;
   - history rows for the five versions only as newly applied;
   - sample: no transaction with both cash_sale and non-failed electronic payment without conflict handling;
   - RLS/grants unchanged for RD-01 truncate denial.
4. Deny/drain retained mutation Previews OR accept write-boundary coverage for old writers; alias move alone is insufficient.
5. Deploy exact-SHA Preview; prove BUILD_ID/APP_ORIGIN; only then move tester alias.

## Verification queries (staging, after authorize)

```sql
SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20261009%' ORDER BY 1;
SELECT to_regclass('public.pos_sale_tender_claims');
SELECT proname FROM pg_proc WHERE proname IN (
  'pos_claim_or_require_tender_family','pos_infer_sale_tender_evidence','pos_record_verified_cash_sale','pos_actor_access_is_active'
);
```

## Preview identity plan

- Exact git SHA = final tip below
- Vercel deployment id recorded after build
- `BUILD_ID` / empty origin qualification per prior Preview protocol
- Do not move shared alias until those match

## Gate proof (local / CI)

- Disposable migration-window: cash blocked by retained card intent (0 cash rows)
- pgTAP: `tender_write_boundary.sql`, `staff_access_disabled_shift.sql`, `db_sec_cash_authz.sql`
- Bridge PHP: `php tests/bridge/run.php` — prepare delete/trash/refund-delete PASS