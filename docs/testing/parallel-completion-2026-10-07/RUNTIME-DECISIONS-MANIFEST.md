# Runtime decisions — separate authorizations

Approval of one section does **not** authorize another. Production effects: NONE until each section is explicitly approved and executed.

## 1. Staging privilege repair — UNAPPROVED

| Item | Value |
|---|---|
| Shipping file | `supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql` |
| Exact candidate SHA | `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd` (included in combined `daac7e0`) |
| Target project | **UNVERIFIED** — name exact staging Supabase project/database before apply |
| Process | Apply **only** this forward migration via compatible hosted migration process; do not deploy every pending migration or rewrite history |

Effects: revoke `TRUNCATE` from `PUBLIC`/`anon`/`authenticated` on 11 named operational tables; revoke `EXECUTE` on helper from those roles; leave row `SELECT`/`INSERT`, RLS, `service_role` unchanged.

Preflight: before/after `has_table_privilege` for TRUNCATE; prove SELECT/INSERT remain; row counts with concurrent-change tolerance; stop if unexpected privilege/count regression.

Rollback: must **not** re-grant TRUNCATE; use a reviewed forward correction. Residual UPDATE/DELETE/default-privilege questions stay separate.

## 2. Live transaction qualification — UNAPPROVED

Necessary-quote approval ≠ cash/stock/payment authorization. Prepare fixtures only; execute only under existing explicit grants.

Separate scenarios: cash tender; electronic sandbox; concurrent stock; response-loss/reload recovery using original transaction/idempotency identity.

Inputs to pin before run: training register/shift/session, product/customer/location fixtures, correlation UUIDs, expected Woo order/payment/stock deltas, safe recovery identity.

See also `LANE-B-LIVE-RUNTIME-PLAN.md` when present on the release-140 worktree.

## 3. Device, printing and rollback — UNAPPROVED

Executable checklist (do not claim from desktop-only Lane D):

1. Install production build on cashier device as PWA; record build SHA.
2. Reload/reconnect; confirm drafts/journal retained; pending-operation update deferral.
3. Print one receipt + reprint; confirm receipt failure does not re-run payment/order/stock.
4. Stale-bundle transition without clearing storage.
5. Disposable backup/restore demo with explicit target/data scope; cite `docs/runbooks/R10-BACKUP-RESTORE-ROLLBACK.md`. Untested backup ≠ restore proof.
