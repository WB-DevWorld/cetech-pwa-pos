# DB-SEC-02 / DB-SEC-03 — disposable probe + repair

Status: **REPRODUCED on local supabase_db · SOURCE-REPAIRED · TEST-QUALIFIED (disposable)**  
Hosted staging: **NOT applied** · Production effects: **NONE**  
Staff-documentation impact: **NONE**

## Environment

- Target: `supabase_db_cetech-pwa-pos` loopback (`127.0.0.1:54322`), migrated local stack with synthetic `org_a` / `loc_a1` / `reg_a` / `cashier_a` seed.
- Never run on hosted staging/production. Probes `BEGIN`/`ROLLBACK`.
- Schema-adapted probes (review ZIP SQL omitted org/location columns present on current `pos_shifts` / `pos_cash_movements`).

## Before repair (UNEXECUTED → executed)

| Probe | Result |
| --- | --- |
| DB-SEC-02 direct correction | **OPEN** — `DIRECT_CORRECTION_RESULT corrections=1`, `admin_audit_rows=0`; admin RPC denied (control PASS); empty-location insert denied (control PASS) |
| DB-SEC-03 disabled Auth JWT cash insert | **OPEN** — `DISABLED_CASH_INSERT count=1`; register SELECT still visible |

## Repair (proposed migration, local-applied only)

`supabase/migrations/20261009140000_db_sec_02_03_cash_authz.sql`

- Remove `correction` from authenticated-allowed cash kinds in `pos_cash_before_write` (DB-SEC-02).
- Add `pos_actor_access_is_active` (SECURITY DEFINER boolean; no table SELECT grant) and require it for authenticated cash inserts (DB-SEC-03).
- Preserve `pos_admin_reverse_cash_movement` (SECURITY DEFINER / service_role) audited corrections.

## After repair (local)

| Check | Result |
| --- | --- |
| DB-SEC-02 direct correction | **CLOSED** — 42501 denied |
| Admin reverse (service_role) | **PASS** — correction row + audit path intact |
| DB-SEC-03 disabled pay_in | **CLOSED** — 42501 `actor is disabled` |
| Active pay_in after reactivate | **PASS** |

## Classification

- Defects: **SOURCE-REPAIRED** + **TEST-QUALIFIED** on disposable local Postgres.
- **NOT RUNTIME-QUALIFIED** on hosted until separately authorized migration apply.
- AUTH-02 customer-read policy: still a decision item; not invented here.

## Rollback

Revert/replace `pos_cash_before_write` and drop `pos_actor_access_is_active` if the additive migration must be withdrawn before hosted apply.