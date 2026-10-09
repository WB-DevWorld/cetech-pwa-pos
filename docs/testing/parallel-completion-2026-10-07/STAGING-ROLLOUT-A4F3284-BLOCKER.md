# STAGING-ROLLOUT-A4F3284-01 — operator blocker (pre-effect)

UTC start: 2026-10-09 (controlled rollout)
Exact SHA: `a4f3284c35785dbb0efe3843d38084f12911ac15`
Owner approval: recorded in CURRENT-WORK (2026-10-09T18:15:52Z)
Production effects: **NONE**
Remote effects performed: **NONE** (no hosted migration, bridge write, Preview, or admission change)

## Preconditions verified locally

| Check | Result |
| --- | --- |
| PR #144 head == a4f3284 | PASS |
| Five migration SHA-256 vs packet | PASS (all MATCH) |
| Bridge `class-woo-runtime.php` SHA-256 vs packet | PASS (`fa478ea4…`) |
| Training SSH `cetechtrainingappserver` BatchMode | PASS |
| Installed training bridge hash | `89e4461c…` (differs from reviewed `fa478ea4…`; update still required after DB) |

## Exact operator blockers (stop)

1. **Staging database session unavailable** — `SUPABASE_ACCESS_TOKEN` is not set in this Cursor operator environment; `npx supabase projects list` returns `AccessTokenRequiredError`. Cannot run conflict precheck, backup snapshot via Management API, or `apply_migration` for the five named files on `iegxncvpsyaitkpzywcr`.
2. **Vercel CLI unauthenticated / API fetch failed** — no local Vercel auth store; `vercel whoami` / `vercel ls` fail with `TypeError: fetch failed` / not logged in. Cannot create the exact-a4f3284 Preview on `prj_tgfdys6XJN9HLDRbAvelsLlOt5lq`.

Per packet: do not ask the owner to paste database credentials into chat. Operator must attach the existing staging Supabase access and Vercel login to this machine/session (for example `supabase login` and `vercel login` in the operator environment), then re-run this same task. No credentials belong in source, PR text, or agent logs.

## Durable state

- Tester remains `452c446` / `dpl_F3uXp…`
- Hosted schema unchanged (not contacted)
- Training bridge file unchanged on disk
- Ledger records approval + this blocker

## Next exact action after access restored

Resume at packet step 2 (backup/recovery) → conflict precheck → atomic/barrier five-migration apply → verify → bridge FPM transition → exact Preview → noncommercial checks → tester docs + execution receipt.