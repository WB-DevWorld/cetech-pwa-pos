# Parallel completion — 60-minute checkpoint

UTC: started ≈ 2026-10-07T19:33:57Z · checkpoint ≈ 2026-10-07T19:56:04Z.  
Reconciled for combined candidate PR #144 on 2026-10-08 (Lane 2 docs + qualification prep after root verify `2026-10-08T15:02Z`).  
Production effects: **NONE**. **NOT READY FOR PRODUCTION.**

## What the owner can test now

Keep using the **existing tester URL** (alias unchanged; `dpl_nxWG…` READY / `BUILD_ID` `816e0bb…`). Combined source candidate is PR **#144** tip `ab5c7e1…` (includes product repair `27e95b3…` + final correction; application baseline `#140` `0e383d84…` + `#143` privilege repair + race-fix). Automatic **unpromoted Preview** READY: `dpl_CBSA…` — https://cetech-pos-staging-pji89co71-wbdevworlds-projects.vercel.app (not aliased; not production; prior `dpl_fQq…`/`5ea92dc…` superseded). Do not treat #141 diagnostics as release input. Tester alias must not move.

Local/source gates that were green on the `#140` baseline: checkout/recovery suites (Lane B), receipt/scanner fixtures (Lane C), PWA/desktop SW checks + production build (Lane D). Race-fix product is **in this combined candidate** (not concurrent elsewhere); **not** installed on training bridge (`0.6.0-stg05` still global order-count). Staging #143 preflight root-verified (version ABSENT; Authenticated TRUNCATE still true on 11 tables) but **apply unauthorized**. Still open for humans: hosted #143 apply, training bridge install, Track C stock=1 fixture, installed-PWA/hardware, physical printer, shared/paid restore, any live cash/stock/payment. Issues **#115** / **#132** remain open. Profiler Lane E parked.

## Consolidated candidate

| Field | Value |
|---|---|
| Product tip (PR #144) | `ab5c7e1f3849ff65100a84058e92f8b281a14be2` |
| Docs tip (PR HEAD) | `ad5ccbc7eb6807f56018d6e71af1b0c1c715c6e7` |
| Product repair | `27e95b3565dbdf3c5487257a08042e09a51620a4` + final correction in `ab5c7e1` |
| Application baseline SHA | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` (`#140`) |
| Includes | #139 `3c2a5a6a…`; race product `daac7e0…`; #143 `c512b10…`; R144 `ab5c7e1…` |
| Security candidate (imported, hosted DDL unauthorized) | #143 `c512b10…` blob `6936b0e…` |
| Excludes | #141 diagnostic |
| Rollback (app) | `0e383d84…` (DB TRUNCATE must not be re-granted) |
| Tester source (do not move) | `816e0bb…` / `dpl_nxWG…` READY |
| Product Preview (unpromoted) | `dpl_CBSA…` READY — tip `ab5c7e1…` |
| Docs Preview (unpromoted) | `dpl_GDqi…` READY — tip `ad5ccbc…` |
| Deployment manifest | `CANDIDATE-DEPLOYMENT-MANIFEST.md` |
| Runtime decisions | `RUNTIME-DECISIONS-MANIFEST.md` |
| RD decision sheet | `QUALIFICATION-RD-DECISIONS.md` |

Changed-file/schema this hour (historical parallel lanes): lane evidence/docs + Lane B order-count **fixture** + Lane C timing helpers. Combined candidate later added race product + #143 import + R144 repair. No hosted schema apply. No production code merge into protected main.

## Lane table

| Lane | Completed outcome | Tested SHA/environment | Remaining blocker | Next action |
|---|---|---|---|---|
| A security | Local PASS: no GRANT TRUNCATE; helper+invoke; seed/replay + omit-invoke NC; pgTAP 20/419 | `c512b10` / PR #143 | Hosted apply unauthorized; staging preflight green (24 migs; `20261006025100` ABSENT; Auth TRUNCATE true on 11) | Authorize pinned staging apply per RD-01 only |
| B checkout | 172 checkout/recovery tests PASS; global Woo order-count race **reproduced** then **fixed in source** on combined (`daac7e0`→`27e95b3`) | app `0e383d84`; evidence `7f384b4`; product `27e95b3` | Training bridge still pre-fix `0.6.0-stg05`; Track C needs stock=1 fixture | Live plan prepared; install/activate combined bridge only when RD-02 authorized |
| C receipts | Fixture PASS (scans, Pay guards, cart retirement, receipt fail/reprint); no product fix | `0e383d84` | Physical printer/scanner UNVERIFIED | Hardware/print steps in `LANE-C-RESULT.md` when authorized |
| D PWA/release | PASS_WITH_GATES: 122 focused + build PASS; desktop isolated-profile 7/7 | app `0e383d84`; evidence `b0b0c3a` | Installed-PWA/hardware + backup/restore open; Preview READY but unpromoted | Use Preview for inspection; **no** tester alias move without RD-03 |
| E price delay | **Parked.** No request-scoped profiler on training | read-only + `RESULT-REST-INIT` | Missing XHProf/Tideways/QM/SAVEQUERIES/slowlog | New profiler lease if pursued; no band-only re-quotes |

## Remaining execution decisions (one manifest + decision sheet)

1. Staging apply of #143 migration — yes/no + operator (RD-01; pinned only; no bulk pending).
2. Authorized install/activate of combined bridge (`27e95b3`) on training + bounded tracks A–D (RD-02).
3. Track C last-unit fixture — reduce/fingerprint stock=1 (49111@4 cannot prove last-unit with two qty-1).
4. Shared/paid/remote restore or tester alias move only under RD-03.
5. Optional gated PHP profiler lease for price delay (Lane E) — remains parked.

Local/source qualification ≠ live commerce parity. No production promotion. Optional acceptance of an unrepaired race is **not** the default — race is fixed in combined source; training install is a separate gate.
