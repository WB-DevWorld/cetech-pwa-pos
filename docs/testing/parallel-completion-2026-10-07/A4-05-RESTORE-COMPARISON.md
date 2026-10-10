# A4-05 retained restore comparison

Acting: `@wbdevworld` / WS3  
UTC: `2026-10-10T07:05Z`  
Source baseline: `019065b0a89dc26ae8d13a413f7ae6ec31ab21e3`  
No new dump, password, or hosted write.

## Archive

| Check | Result |
| --- | --- |
| File | `%LOCALAPPDATA%\CETECH-POS-R10\private\dumps\iegxn-a4-rolefix-20261010T060440Z.dump` |
| Bytes | **1,019,335** |
| SHA-256 | `728E86E471E944135796ADC5725FF605EC15F41DAE9D8F4C79B828F906DE04B3` |
| Classification | **MATCH** to the accepted A4-04 archive |

## Restored database

Cluster `cetech-pos-a4-restore-20261010`, database `a4_restore_empty`, container `supabase_db_cetech-pos-a4-restore-20261010`, host port `127.0.0.1:55322`. Read with `supabase_admin` inside the container. No new restore was run.

| Inventory | Restored | Classification |
| --- | --- | --- |
| public tables / RLS | **36 / 36 enabled**, forced **0** | **MATCH** to the A4-04 table and RLS-enabled counts |
| auth tables / RLS / sequences | **27 / 16 / 1** | **MATCH** |
| storage tables / RLS | **8 / 8** | **MATCH** |
| `supabase_migrations` tables | **1** | **MATCH** |
| vault tables | **1** | **MATCH** |
| migration rows | **30**, including `20261009214234` through `20261009214238` | **MATCH** to the A4-04 applied history |

Repo migration *filenames* on this branch are not the same strings as the hosted `schema_migrations.version` values. The retained database has the hosted history that was in the archive. That is not missing recovery content.

Public RLS policies: **12**, on 9 tables (`pos_organizations`, `pos_locations`, `pos_devices`, `pos_registers`, both staff assignment tables, `pos_shifts`, `pos_cash_movements`, `pos_pending_operations`). The other **27** public tables have RLS enabled and **no policy**. For a non-owner role that is fail-closed, not a dropped table. Forced RLS is off. This comparison did not replay policy text against a second live database; policy *presence* is from the restored catalog only.

Public functions: **50**. Public non-internal triggers: **21**.

## Sale 50343

Transaction `ac637dda-e081-47e3-bd60-cf80f9569c04`:

| Link | Count |
| --- | --- |
| `pos_checkout_sales` | 1, status `completed`, `commercial_confirmed` true |
| `pos_checkout_payments` | 1, tender `cash`, status `verified`, source `cash_ledger`, amount **2900 GHS** |
| `pos_checkout_receipts` | 1 |
| `pos_cash_movements` | 1, kind `cash_sale`, signed amount **2900** |
| `pos_sale_tender_claims` | 1 |

Classification: **MATCH** to the accepted A4-04 tender proof. No row was changed.

## Not in this restore

Storage object files, global role passwords, Vault/service keys, Auth SMTP/provider/JWT configuration, and Edge Function deployment are not in the PostgreSQL archive. They stay separate service-recovery requirements.

## What was not re-run

No second dump, no hosted migration, no pgTAP apply against this database in this pass. Security/tender tests that need a writable fixture were not applied here; the comparison is catalog and the already restored 50343 rows.
