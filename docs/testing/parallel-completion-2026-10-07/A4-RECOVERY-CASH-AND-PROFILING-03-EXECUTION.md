# A4-RECOVERY-CASH-AND-PROFILING-03 — execution after owner GO

Acting: `@wbdevworld` / WS3  
Owner authorization: explicit chat **GO** / **GO** `2026-10-10` covering (1) read_only login+export+isolated restore and (2) one cash ≤GHS29 on 49111  
Product freeze: `a4f3284…` · Preview `dpl_FAaW712…` / `q2u9baevb`  
Staff-documentation impact: **NONE** (tester checklist note only in testing docs; no staff procedure change)  
Production effects: **NONE** (staging/training only)  
Verdict: **NOT READY FOR PRODUCTION**

## Lane 1 — backup/restore

| Step | Result |
| --- | --- |
| `POST .../cli/login-role` `{"read_only":true}` | Issued · role name `cli_login_supabase_read_only_user` · **ttl_seconds=300** |
| Direct host `db.iegxn….supabase.co` | **AAAA-only**; host IPv6 TCP **false**; Docker cannot use as dump path |
| Documented pooler **session** `:5432` (IPv4) | Connect OK as `cli_login_supabase_read_only_user.<project_ref>` · TLS `require` |
| Full `pg_dump` | **FAIL** — `permission denied for schema auth` (LOCK TABLE auth.*) |
| Also denied | `supabase_migrations` SELECT (`permission denied for schema supabase_migrations`) |
| Complete recovery artifact + isolated restore compare | **NOT ACHIEVED** |
| Gate | **BLOCKED** on exact denied schemas: **`auth`**, **`supabase_migrations`** (default dump coverage). No `SET ROLE postgres`. No public-only dump claimed as PASS. Credentials not committed; sticky private cred file cleaned after attempts. |

Prep target `cetech-pos-a4-restore-20261010` remains unused for restore.

Private denial note: `%LOCALAPPDATA%\CETECH-POS-R10\private\iegxn-a4-dump-DENIED.json`

## Lane 2 — fresh cash sale (PASS)

### Preconditions (read-only)

| Check | Value |
| --- | --- |
| Session | Staging Manager · `manager_a` · `org_a` · `loc_a1` |
| Shift | **open** `e82217c6-3e20-4131-abbb-1b6668e2622b` · `reg_a` · device `00000000-0000-4000-8000-0000000000a1` (not opened/closed) |
| Cash capability | available |
| Product | Woo **49111** · POS `d7c385f0-44e4-541e-b85a-267586d98857` · qty **1** · walk-in |
| Stock baseline S | **3** → after sale **2** (WP meta `2026-10-10T03:24:30Z`) |
| Quote | GHS **29.00** (2900 minor) · Price ready |
| Cart | `21a580a5-53cf-481f-b3da-cd25c561b452` rev **1** · line `323bdfbf-33b7-47fa-9da4-bfa853e1aef6` |

### Effects (single sample)

| Identity | Value |
| --- | --- |
| transactionId | `ac637dda-e081-47e3-bd60-cf80f9569c04` |
| saleId | `sale-50343` |
| Woo / orderReference | **50343** · HPOS `wc-processing` · total **29.00** GHS · created `2026-10-10 03:23:04Z` |
| receipt | `rcpt-ac637dda-e081-47e3-bd60-cf80f9569c04` / `POS-50343` |
| tender claim | **cash** · actor `manager_a` · claimed_at `2026-10-10T03:23:33Z` |
| payment | `d28ef2f3-c05e-477a-83c7-867a1f2b658c` · verified · cash_received 2900 · source `cash_ledger` |
| cash movement | `64d2106e-31b8-4098-9811-e1ba85d46095` · kind `cash_sale` · +2900 · shift `e82217c6…` |
| Claims total after | cash **25** / electronic **0** |
| Dual-family / orphan claims | **0** / **0** |
| Stock | **49111** **3→2** |
| Cart after | empty draft (new cartId) · next-sale ready |
| Journal | IndexedDB count **3** after sale (completed-path artifacts; unresolved recovery still **not** separately qualified) |

### Timing (one qualification sample — not p95)

| Interval | Approx |
| --- | --- |
| Confirm cash → UI idle / next-sale ready | ~**21.6 s** browser (inclusive) |

One prepare · one cash confirm · no electronic · no second sale · no A+D replay.

## Lane 3

Unchanged from prior tip (`LANE3-CORRECTED-REST-PROFILE-A4F3284.md`): nested-init missing; `--all` `WP_CLI\Path` failure.

## Still open

| Gate | Status |
| --- | --- |
| Full POS backup/restore | **BLOCKED** (auth + migrations schema grants on cli login) |
| Electronic TEST / last-unit C | unrun |
| #115 / #132 | OPEN |
| Device/PWA/scanner/paper | tester-owned |
| Unresolved-journal recovery drill | NOT EXERCISED as dedicated failure case |

## Tester URL

https://cetech-pos-staging-q2u9baevb-wbdevworlds-projects.vercel.app
