# STAGING-ROLLOUT-A4F3284-01 — operator blocker (CLEARED)

UTC cleared: 2026-10-09T21:48Z (approx)  
Exact SHA: `a4f3284c35785dbb0efe3843d38084f12911ac15`  
This file previously recorded pre-effect access blockers (Supabase token + Vercel login). Those are **cleared**.

## Cleared blockers

1. Staging Supabase Management API access restored (`SUPABASE_ACCESS_TOKEN` in operator environment).
2. Vercel CLI authenticated as `wbdevworld` for team/project Preview create.

## Durable outcome

See `STAGING-ROLLOUT-A4F3284-EXECUTION-RECEIPT.md` and `TESTER-ACCEPTANCE-CHECKLIST-a4f3284.md`.

| Surface | State |
| --- | --- |
| Staging five migrations | APPLIED (hosted `20261009214234`…`20261009214238`) |
| Training bridge runtime | DISK `fa478ea4…`; native FPM loaded-generation **UNVERIFIED** |
| Exact Preview | `dpl_FAaW712…` / `q2u9baevb` READY |
| Shared tester alias | unchanged (`816e0bb…`) |
| Authenticated noncommercial | PENDING operator private sign-in |
| Production | **NOT READY** / not authorized |

Do not re-open this blocker for ordinary continuation; use the execution receipt for remaining gates.
