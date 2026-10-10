# A4-RECOVERY-CASH-AND-PROFILING-03 — consolidated results

Acting: `@wbdevworld` / WS3  
UTC: `2026-10-10T03:28Z`  
Prior tip at GO: `6d51b234fe720acced6e2700307f9f1a92cdc349`  
Published evidence tip: `e5df10e57339cc1e7eebd26c036ba77093d9d259` (PR #144)  
Product freeze: `a4f3284c35785dbb0efe3843d38084f12911ac15` (unchanged)  
Preview: `dpl_FAaW712…` / `q2u9baevb`  
Owner authorization: explicit chat **GO** / **GO** `2026-10-10`  
Staff-documentation impact: **NONE** (testing checklist note only; no `docs/staff/*.md` procedure change)  
Production effects: **NONE** beyond authorized staging cash sale + private dump attempt  
Verdict: **NOT READY FOR PRODUCTION**

Detail: `A4-RECOVERY-CASH-AND-PROFILING-03-EXECUTION.md`

## Owner authorization actually used

| Scope | Authorization | Outcome |
| --- | --- | --- |
| Isolated local profiling | Packet (pre-GO) | Nested-init miss; `--all` `WP_CLI\Path` fatal — timings still open |
| Temporary read-only CLI login + export + isolated restore | **GO** | Login issued (TTL 300s); pooler session IPv4 connect OK; **pg_dump FAIL** on schemas `auth` + `supabase_migrations` → restore **NOT RUN** |
| Fresh cash ≤GHS29 qty1 Woo **49111** | **GO** | **PASS** — Woo **50343** / txn `ac637dda…` / sale-50343 |
| Electronic B / last-unit C | Deferred | Unrun |

## Lane outcomes

| Lane | Result | Remaining dependency |
| --- | --- | --- |
| 3 Corrected REST profile | Nested-init capture missing; `--all` fatal | usable exclusive timings; #132 |
| 1 Backup/restore | **BLOCKED** — exact denials: `permission denied for schema auth`; `permission denied for schema supabase_migrations`. Direct host AAAA-only; pooler session `:5432` usable for connect only. No public-only dump claimed as PASS. | grant path / alternate export / Management backup artifact |
| 2 Cash sale | **PASS** (one sample) | — |

## Cash sale identities (single sample)

| Field | Value |
| --- | --- |
| transactionId | `ac637dda-e081-47e3-bd60-cf80f9569c04` |
| saleId | `sale-50343` |
| Woo / orderReference | **50343** · HPOS `wc-processing` · total **29.00** GHS · `2026-10-10 03:23:04Z` |
| receipt | `rcpt-ac637dda-e081-47e3-bd60-cf80f9569c04` / `POS-50343` |
| product | Woo **49111** · stock **3→2** |
| tender | cash claim · payment verified · `cash_sale` movement +2900 |
| claims after | cash **25** / electronic **0** · dual-family/orphan **0** |
| Confirm→next-sale ready | ~**21.6 s** (one sample; not p95) |
| Journal | IndexedDB count **3** post-sale; unresolved recovery still **NOT EXERCISED** |

**Do not replay** this cash sale or A+D (`50317`). Cap for this packet is consumed.

## Unchanged identities

Migrations / RD-01 / bridge `fa478ea4…` / native FPM proof / Preview — frozen accepted. No product rebuild for docs tip.

## Still open

| Gate | Status |
| --- | --- |
| Full POS backup/restore | **BLOCKED** (cli login lacks `auth` + `supabase_migrations`) |
| Electronic TEST / last-unit C | unrun |
| #115 / #132 | OPEN |
| Device/PWA/scanner/paper | tester-owned |
| Unresolved-journal recovery | NOT EXERCISED |

## Artifacts

- `A4-RECOVERY-CASH-AND-PROFILING-03-EXECUTION.md`
- `LANE3-CORRECTED-REST-PROFILE-A4F3284.md`
- `LANE1-BACKUP-PREP-A4F3284.md` (prep retained; restore unused)
- Private denial note `%LOCALAPPDATA%\CETECH-POS-R10\private\iegxn-a4-dump-DENIED.json`
- Private restore workdir unused for restore

## Next exact owner action

Choose path for Lane1 (schema grants / platform backup download / accept BLOCKED) and/or authorize electronic B / last-unit C separately. No further cash on 49111 without new GO. Testers continue §A–C on checklist; optional software reprint of **50343** in addition to retained **50317**.
