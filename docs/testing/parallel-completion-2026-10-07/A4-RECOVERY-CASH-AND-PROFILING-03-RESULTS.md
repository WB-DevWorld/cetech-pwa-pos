# A4-RECOVERY-CASH-AND-PROFILING-03 — consolidated results

Acting: `@wbdevworld` / WS3  
UTC: `2026-10-10T03:20Z`  
Reviewed evidence head at start: `1bb485668abf8c7cbf9c33733168828a9bf161a8`  
Product freeze: `a4f3284c35785dbb0efe3843d38084f12911ac15` (unchanged)  
Preview: `dpl_FAaW712…` / `q2u9baevb`  
Staff-documentation impact: **NONE**  
Production effects: **NONE**  
Verdict: **NOT READY FOR PRODUCTION**

## Owner authorization actually used

| Scope | Authorization |
| --- | --- |
| Isolated local profiling | Allowed by packet — **executed** |
| Temporary read-only CLI login + export + isolated restore | **NOT GRANTED** — parked after prep |
| Fresh cash ≤GHS29 on 49111 | **NOT GRANTED** — parked (recommendation A ≠ GO) |
| Electronic B / last-unit C | **DEFERRED** per packet |

## Lane outcomes

| Lane | Result | Remaining dependency |
| --- | --- | --- |
| 3 Corrected REST profile | Focused `[]` + init count **1** → **nested-init capture missing**; `--all` fatal `WP_CLI\Path` not found | usable timings still open; #132 open |
| 1 Backup/restore | Prep only — direct host `db.iegxncvpsyaitkpzywcr.supabase.co`; target `cetech-pos-a4-restore-20261010` initialized | **owner GO** then one read_only login |
| 2 Cash sale | **NOT STARTED** | **owner GO** for Option A caps |

## Unchanged identities

Migrations / RD-01 / bridge `fa478ea4…` / native FPM proof / Preview — frozen accepted. No rebuild for docs tip.

## Journal / electronic / last-unit / hardware

| Gate | Status |
| --- | --- |
| Unresolved journal recovery | **NOT EXERCISED** |
| Electronic TEST | unconfigured — unrun |
| Last-unit C | deferred — unrun |
| Device/PWA/scanner/paper | tester-owned pending |

## Artifacts

- `LANE3-CORRECTED-REST-PROFILE-A4F3284.md`
- `LANE1-BACKUP-PREP-A4F3284.md`
- Private profile captures under `%LOCALAPPDATA%\CETECH-POS-R10\a4-wpcli-profile-20261010\`
- Private restore workdir `%LOCALAPPDATA%\CETECH-POS-R10\cetech-pos-a4-restore-20261010\`

## Next exact owner action

Reply with an explicit GO covering **(1)** read_only login+export+restore and/or **(2)** Option A cash ≤GHS29 on Preview `a4f3284` — then execution continues without per-substep asks. Or defer both.
