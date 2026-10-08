# Parallel completion — 60-minute checkpoint

UTC: started ≈ 2026-10-07T19:33:57Z · checkpoint ≈ 2026-10-07T19:56:04Z.  
Reconciled for combined candidate PR #144 on 2026-10-08 (Lane 2 docs).  
Production effects: **NONE**. **NOT READY FOR PRODUCTION.**

## What the owner can test now

Keep using the **existing tester URL** (alias unchanged; live `BUILD_ID` still `816e0bb…`). Combined source candidate is PR **#144** tip `7d75c39…` (includes application baseline `#140` `0e383d84…` + `#143` privilege repair + race-fix product `daac7e0…`). Do not treat #141 diagnostics as release input. Tester alias must not move.

Local/source gates that were green on the `#140` baseline: checkout/recovery suites (Lane B), receipt/scanner fixtures (Lane C), PWA/desktop SW checks + production build (Lane D). Race-fix product is **in this combined candidate** (not concurrent elsewhere); **not** installed on training bridge (`0.6.0-stg05` still global order-count). Still open for humans: staging TRUNCATE apply (#143), installed-PWA/hardware, physical printer, backup/restore, any live cash/stock/payment. Issues **#115** / **#132** remain open. Profiler Lane E parked.

## Consolidated candidate

| Field | Value |
|---|---|
| Combined tip (PR #144) | `7d75c3944d41a5990aa64004c9e96954779c9730` |
| Application baseline SHA | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` (`#140`) |
| Includes | #139 `3c2a5a6a…`; race product `daac7e0…`; #143 `c512b10…` |
| Docs-only tips (not product) | `58af8dc…`, `a0d93de…`, `7d75c39…` |
| Security candidate (imported, hosted DDL unauthorized) | #143 `c512b10…` |
| Excludes | #141 diagnostic |
| Rollback (app) | `0e383d84…` (DB TRUNCATE must not be re-granted) |
| Tester source (do not move) | `816e0bb…` |
| Deployment manifest | `CANDIDATE-DEPLOYMENT-MANIFEST.md` |
| Runtime decisions | `RUNTIME-DECISIONS-MANIFEST.md` |

Changed-file/schema this hour (historical parallel lanes): lane evidence/docs + Lane B order-count **fixture** + Lane C timing helpers. Combined candidate later added race product + #143 import. No hosted schema apply. No production code merge into protected main.

## Lane table

| Lane | Completed outcome | Tested SHA/environment | Remaining blocker | Next action |
|---|---|---|---|---|
| A security | Local PASS: no GRANT TRUNCATE; helper+invoke; seed/replay + omit-invoke NC; pgTAP 20/419 | `c512b10` / PR #143 | Staging DB access BLOCKED this session; hosted DDL unauthorized | Authorize staging apply per DB-SEC-01 only after access + preflight |
| B checkout | 172 checkout/recovery tests PASS; global Woo order-count race **reproduced** then **fixed in source** on combined (`daac7e0`) | app `0e383d84`; evidence `7f384b4`; product `daac7e0` | Training bridge still pre-fix `0.6.0-stg05` | Live plan prepared, not executed; install/activate combined bridge only when authorized |
| C receipts | Fixture PASS (scans, Pay guards, cart retirement, receipt fail/reprint); no product fix | `0e383d84` | Physical printer/scanner UNVERIFIED | Hardware/print steps in `LANE-C-RESULT.md` when authorized |
| D PWA/release | PASS_WITH_GATES: 122 focused + build PASS; desktop isolated-profile 7/7 | app `0e383d84`; evidence `b0b0c3a` | Installed-PWA/hardware + backup/restore open | Exact SHA Preview only if authorized; **no** tester alias move |
| E price delay | **Parked.** No request-scoped profiler on training | read-only + `RESULT-REST-INIT` | Missing XHProf/Tideways/QM/SAVEQUERIES/slowlog | New profiler lease if pursued; no band-only re-quotes |

## Remaining execution decisions (one manifest)

1. Staging apply of #143 migration — yes/no + operator (after DB access + preflight).
2. Authorized install/activate of combined bridge race fix on training (or explicit fail-closed acceptance).
3. Optional Exact SHA Preview of combined tip / app baseline per `CANDIDATE-DEPLOYMENT-MANIFEST.md` (no alias).
4. Optional gated PHP profiler lease for price delay (Lane E) — remains parked.
5. Installed-PWA / printer / live cash-stock-payment rehearsals under existing authorizations only (`RUNTIME-DECISIONS-MANIFEST.md` RD-02 / RD-03).

Local/source qualification ≠ live commerce parity. No production promotion. Optional acceptance of an unrepaired race is **not** the default — race is fixed in combined source; training install is a separate gate.
