# WS3 acceptance

Done = evidence.

- Each task objective and acceptance in TASKS.md met; branch/commit and changed paths recorded.
- Exact check commands: python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web build; supabase db reset --local; supabase test db; pnpm --dir apps/pos-web test:e2e; foundation check always applies. Capture exit results, not agent confidence.
- Fresh database reset, RLS denial matrix, server authorization, secret absence, provider/POS partial-failure repair and full slice evidence.
- Performance measurements include device/environment/data size and p50/p95; budgets in IMPLEMENTATION-PLAN.md.
- No unexpected files, private data or secrets; no unreviewed contracts, schema changes or migrations.
- Runtime gaps recorded as UNVERIFIED/BLOCKED, never replaced by mock results.
- Handoff complete; reviewer recorded; dependent gate recorded in integration evidence before next phase.
