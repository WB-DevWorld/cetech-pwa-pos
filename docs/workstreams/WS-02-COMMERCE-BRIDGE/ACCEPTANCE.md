# WS2 acceptance

Done = evidence.

- Each task objective and acceptance in TASKS.md met; branch/commit and changed paths recorded.
- Exact check commands: make -C wordpress/cetech-pos-bridge check; make -C wordpress/cetech-pos-bridge test; make -C wordpress/cetech-pos-bridge parity; foundation check always applies. Capture exit results, not agent confidence.
- Versioned actual Woo checkout-versus-bridge pricing matrix, isolated contexts, HPOS mode and concurrent/idempotency/stock failure evidence.
- Performance measurements include device/environment/data size and p50/p95; budgets in IMPLEMENTATION-PLAN.md.
- No unexpected files, private data or secrets; no unreviewed contracts, schema changes or migrations.
- Runtime gaps recorded as UNVERIFIED/BLOCKED, never replaced by mock results.
- Handoff complete; reviewer recorded; dependent gate recorded in integration evidence before next phase.
