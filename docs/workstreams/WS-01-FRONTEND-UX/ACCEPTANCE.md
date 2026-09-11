# WS1 acceptance

Done = evidence.

- Each task objective and acceptance in TASKS.md met; branch/commit and changed paths recorded.
- Exact check commands: pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web test:e2e; foundation check always applies. Capture exit results, not agent confidence.
- Side-by-side reference screenshots on phone/tablet/desktop; barcode, keyboard, stale quote, pending tender and recovery behavior exercised.
- Performance measurements include device/environment/data size and p50/p95; budgets in IMPLEMENTATION-PLAN.md.
- No unexpected files, private data or secrets; no unreviewed contracts, schema changes or migrations.
- Runtime gaps recorded as UNVERIFIED/BLOCKED, never replaced by mock results.
- Handoff complete; reviewer recorded; dependent gate recorded in integration evidence before next phase.
