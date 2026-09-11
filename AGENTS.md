# CETECH POS agent entry point

Read in order: [SOURCE-OF-TRUTH.md](SOURCE-OF-TRUTH.md), [current architecture](docs/architecture/CURRENT-ARCHITECTURE.md), [Decision Register](docs/decisions/DECISION-REGISTER.md), applicable ADRs, [OWNERSHIP.md](OWNERSHIP.md), then your workstream's eight documents and the assigned issue.

Before edits, state the task ID, workstream, allowed/forbidden paths, canonical owners, contracts affected, dependencies and acceptance criteria. Check CURRENT-WORK.md and git status. Preserve unrelated changes. One task branch and worktree per concurrent assignment; no shared mutable checkout.

Git/repository truth outranks private AI memory.
A historical ChatGPT conversation cannot override a newer approved ADR or current contract.
Generated code cannot silently redefine architecture.
Cursor conversation history is not canonical project truth.

## Hard boundaries
- UI consumes provider-neutral ports. Never reproduce WoodMart/B2BKing pricing or call privileged Woo/provider APIs from browser code.
- Woo owns transitional commerce. Supabase owns POS operations and explicitly rebuildable projections. Dexie owns local drafts/journal, never enterprise commerce truth.
- No P0 InventoryPort. Quote checks availability; prepare owns definitive stock validation. PrintPort handles print side effects separately from immutable receipts.
- PaymentPort verifies tender; SalesPort confirms commercial sale. Only server orchestration may connect them. A timeout means resolve reality, not charge again.
- Never expose privileged secrets, paste them into agent prompts, or commit production data.
- Never silently change contracts/architecture, edit another workstream's paths, race migrations, casually add dependencies, unnecessarily modify lockfiles or bypass CI for speed.
- Routine PWA recovery must preserve IndexedDB, drafts, journal, unsynced work and auth. Never blindly clear all caches/storage.
- Root config, contract schema/types, migrations, transaction state machine, environment schema, CI and release config have one WS3 editor at a time. Ask the integration lead for a scoped delegation if needed; existing task authorization counts.
- Reference/frontend-approved is immutable. Implement from it in apps/pos-web; do not redesign it.

## Workflow
Audit first. Remediation second. An audit request authorizes findings, severity and proposed fixes, not silent remediation. Implementation authorizes its bounded task, not unrelated redesign.

Run `python3 scripts/verify_control_plane.py` for the foundation. As scaffolds arrive, run the exact additional commands registered in docs/standards/TOOLCHAIN.md and your task. A missing required runtime is BLOCKED, not PASS. Add meaningful risk-based tests; do not manufacture staging or hardware evidence.

Done = evidence. Report exact commands/results, runtime checks, files, contract/migration/ADR changes, assumptions, unresolved conflicts and handoff using docs/ai/HANDOFF-TEMPLATE.md. Stop at your assignment boundary. Production promotion and destructive live actions require the designated human release approval.
