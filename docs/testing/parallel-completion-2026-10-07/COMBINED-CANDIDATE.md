# Combined source candidate — 2026-10-08

**Automatic unpromoted Preview exists. Woo bridge uninstalled on training. Runtime qualification incomplete. NOT READY FOR PRODUCTION.** Tester alias unchanged.

Do **not** blanket-say “NOT DEPLOYED”: frozen Preview `dpl_8pUT…` READY for tip `f0feb44…`; product tip `ab5c7e1` / bridge tree `fc8f2d05` equivalent. Do not restart qual for docs-only tips. Preview is not shared-tester alias, not production, and not live commerce qualification.

| Field | Value |
|---|---|
| PR | [#144](https://github.com/WB-DevWorld/cetech-pwa-pos/pull/144) |
| Frozen Preview | `dpl_8pUT6fhYPKxR6B7uFhoUVUx2ZYJL` — tip `f0feb44…` — https://cetech-pos-staging-d299u3ex7-wbdevworlds-projects.vercel.app |
| Product tip | `ab5c7e1f3849ff65100a84058e92f8b281a14be2` / bridge tree `fc8f2d05…` |
| Observed Preview BUILD_ID | `local-dev` (binding gap; tester remains `816e0bb…`) |
| Prior tip | `5ea92dc1258006186ba696e9d4f91f769d97aa11` (`dpl_fQq…` superseded) |
| R144 product repair | `27e95b3565dbdf3c5487257a08042e09a51620a4` + final correction in `ab5c7e1` |
| Prior tip (REQUEST CHANGES) | `7d75c3944d41a5990aa64004c9e96954779c9730` |
| Race-fix **product** base | `daac7e035d992c2798a317a0cf371f2925a9fe35` |
| Application baseline #140 | `0e383d84f11573ca89d6533c8cb7c35d79d7b261` |
| Privilege repair #143 | `c512b106bce1a0efcfd9c2caeddd54ad9e43dccd` (blob `6936b0e…`) — staging **APPLIED** hosted `20261008151307` |
| Branch | `ws3/combined-candidate-2026-10-08` |
| Shared tester BFF | `dpl_nxWGrSLqaLBGNNN683QjdixNBjF6` READY — `816e0bb…` |
| Optional product Preview | `dpl_CBSAUNVvXLmuXetnwC3z8DLeAdm2` — `acs2cuq3m` URL (not `pji89co71`) |
| RD-02 package | `RD-02-EXECUTION-REQUEST.md` + `bridge-artifact-ab5c7e1/` |
| Excludes | #141 diagnostic |
| Rollback | `0e383d84` (app); DB TRUNCATE must not be re-granted on rollback |
| Open issues (unchanged) | #115, #132 |
| Profiler | PARKED (Lane E) |

## Schema / files

- Additive migration: `supabase/migrations/20261006025100_db_sec_01_revoke_authenticated_truncate.sql` (from #143; staging **APPLIED** as hosted `20261008151307` — see `RD-01-STAGING-EXECUTION-RECEIPT.md`; do not re-apply).
- Bridge: owned-object recovery binder + request-local prepare/quote CRUD guards including refund hook family + `prices_include_tax` — tip `ab5c7e1…`; **not** installed on training (`0.6.0-stg05`).
- Evidence under `docs/testing/parallel-completion-2026-10-07/`.

## Local / CI checks

- Local excl. env-fatal generated return-effects: **1961 passed / 0 failed**; hooks-only **145 passed / 0 failed**.
- Full CI on product tip `ab5c7e1`: run [37798960261](https://github.com/WB-DevWorld/cetech-pwa-pos/actions/runs/37798960261) PASS.
- Full CI on docs tip `ad5ccbc`: run [37800535612](https://github.com/WB-DevWorld/cetech-pwa-pos/actions/runs/37800535612) PASS.

## Remaining live gates (separate authorizations)

See `RUNTIME-QUALIFICATION-CONTINUATION-01.md` + `RD-02-EXECUTION-REQUEST.md`: **RD-01 complete**; RD-02 request ready (A+D; C needs stock=1); Lane 1 needs operator sign-in; RD-03 only if shared/paid/alias. Profiler parked. **NOT READY FOR PRODUCTION.**
