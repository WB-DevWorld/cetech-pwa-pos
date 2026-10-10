# A4-BACKUP-ROLE-AND-PROFILER-04 — consolidated results

Acting: `@wbdevworld` / WS3  
UTC: `2026-10-10T06:10Z`  
Starting review head: `a1d0527382c673a39f7bbe1a9697110884468046`  
Published evidence tip: `28f5788e52fefc85c8f1f5b6797cd5837dd49037` (PR #144)  
Product freeze: `a4f3284c35785dbb0efe3843d38084f12911ac15` (unchanged)  
Preview: `dpl_FAaW712…` / `q2u9baevb`  
Staff-documentation impact: **NONE**  
Production effects: **NONE** beyond one temporary read_only `cli/login-role` + private dump/restore  
Verdict: **NOT READY FOR PRODUCTION**

Cash **50343** / txn `ac637dda…` retained unchanged; cash cap remains **consumed**.

## Credential issuance history (no secrets)

| # | When (UTC) | Evidence | Outcome |
| --- | --- | --- | --- |
| 1 | ~`2026-10-10T03:18:41Z` | dump artifact name `…T031841Z` / meta `dumped_utc` `03:18:44Z` · 0 bytes | Failed dump (no `--role`); schema `auth` denial class |
| 2 | `2026-10-10T03:21:30.858Z` issued · ttl **300** · packet cites expires `2026-10-10T03:27:05.990417Z` | `iegxn-cli-login-readonly.meta.json` + zero-byte `…T032139Z.dump` | Reissuance in same GO window; still no `--role`; `sslmode=require` historical |
| 3 | Corrected A4-04 attempt · dump window `2026-10-10T06:04:43Z`–`06:05:41Z` | `iegxn-a4-04-corrected-dump.meta.json` | **PASS** role test + dump (this task’s single fresh login; not looped) |

Published A4-03 receipt described one issuance; private artifacts show two failed attempts in the GO window, then this separate corrected attempt.

## Lane 1 — corrected `--role` dump + isolated restore

| Step | Result |
| --- | --- |
| Prep | PG 17.6 client · session pooler `:5432` IPv4 · restore target `cetech-pos-a4-restore-20261010` ports **5532x** started · CA = Supabase Root/Intermediate **2021** from pooler chain (`sslrootcert` SHA-256 `12616400…`) |
| TLS | Prior failed attempts: `sslmode=require`. Corrected: **`verify-full`** (labeled separately) |
| Role test | `SET LOCAL ROLE supabase_read_only_user` → `current_user=supabase_read_only_user` · `read_only=on` · `auth_usage=t` · `history_usage=t` · `bypassrls=t` |
| `pg_dump` | `--role=supabase_read_only_user --format=custom --lock-wait-timeout=5000` · **exit 0** · **1,019,335** bytes · SHA-256 `728E86E471E944135796ADC5725FF605EC15F41DAE9D8F4C79B828F906DE04B3` · TOC includes `auth`, `supabase_migrations`, POS tables |
| Restore | Independent DB `a4_restore_empty` on disposable cluster · `pg_restore` as `supabase_admin` · **`--exit-on-error`** · **ACL + owner retained** · **exit 0** |
| Compare 50343 | sale/claim/payment/movement/receipt each **count=1** · sale completed + `commercial_confirmed` · receipt `POS-50343` / order `50343` · cash_sale **+2900** · migrations **30** · a4 `20261009214234`…`38` **5** · public RLS-enabled tables **36** |

### Honest recovery scope (PASS does **not** close)

PostgreSQL dump/restore does **not** include: global role passwords; external Storage files; Vault decryption/service keys; Auth provider/SMTP config; API/JWT keys; Edge Function source/config. Those remain service-recovery dependencies.

Local note: host `postgres` role is **not** superuser on Supabase local; restore required container `supabase_admin` trust. First host-side restore attempts failed on `SET ROLE supabase_admin` / reserved memberships — not claimed as PASS.

## Lane 2 — compatible profile-command v2.1.5

| Item | Value |
| --- | --- |
| Phar | WP-CLI **2.12.0** (unchanged) |
| Package | release **v2.1.5** · commit `dc62982663fc864845508adb6d6b11260540c393` · composer blob `7c2eee3a…` · Profiler blob `7d376575…` · require `wp-cli ^2.12` · **`WP_CLI\Path` absent** |
| Failed package preserved | `packages-failed-wpcli3-path` · composer require **`wp-cli ^3.0`** (runtime fatal was `WP_CLI\Path` under phar 2.12.0) |
| Smoke | **PASS** — package load + `get_name_location_from_callback` + `WP_CLI\Formatter` JSON · PHP **8.3.35** |
| Capture | `profile hook --all --fields=callback,location,time --format=json --orderby=time --order=DESC` · hard **240s** · **exit 0** · rows **618** · `rest_api_init` count **1** · stdout SHA-256 `08315F03…` |
| Top five inclusive parent costs (sorted by `time` DESC; not exclusive; do not sum) | 1) `rocket_init()` **8.867s** `wp-rocket/inc/main.php:43` · 2) `WooLentor\Base->init()` **5.110s** · 3) `XTS\Gutenberg\Gutenberg->files_include()` **4.204s** · 4) `Automattic\WooCommerce\Blocks\BlockTypesController->register_blocks()` **4.090s** · 5) `WPML_ST_Initialize->run()` **2.860s** |

Isolation reconfirmed: `training.cetechbpa.com` **NO_DNS**; URL `http://127.0.0.1:8088/`; `memory_limit=512M`.

This is attribution for the **isolated CLI request**, not proof of current training FPM quote p95. **No speed gain demonstrated.** #115 / #132 remain **OPEN**.

### One measured next optimization (if pursued)

Largest inclusive parent on this isolated `--all` capture is **WP Rocket `rocket_init()` (~8.87s)**. Any optimization must be a separate measured change on an authorized path — not applied in this task.

## Source / remote writes / cleanup

| Action | Done |
| --- | --- |
| `POST /v1/projects/…/cli/login-role` `read_only` (one corrected) | yes |
| Private dump + restore under `%LOCALAPPDATA%\CETECH-POS-R10\` | yes |
| Credential material deleted after dump | yes |
| Collective delete-login-roles | **not** used |
| Product / migrations / bridge / training profiler install | **none** |
| New sale / quote / tender | **none** |

## Remaining gates

Electronic TEST · last-unit concurrency · unresolved-journal failure drill · tester hardware (§A–C) · service-recovery dependencies above · quote performance (#115/#132).

## Artifacts (private paths)

- `%LOCALAPPDATA%\CETECH-POS-R10\private\iegxn-a4-04-corrected-dump.meta.json`
- `%LOCALAPPDATA%\CETECH-POS-R10\private\dumps\iegxn-a4-rolefix-20261010T060440Z.dump`
- `%LOCALAPPDATA%\CETECH-POS-R10\a4-wpcli-profile-20261010\profile-hook-all-v215.stdout.json`
- Restore DB: `a4_restore_empty` on `cetech-pos-a4-restore-20261010` (port **55322**)
