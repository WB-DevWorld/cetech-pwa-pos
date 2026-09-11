# WS3 implementation plan

## Mission
Own the shared application spine, data integrity, authorization, contracts, single-editor configuration and release integration.

## Production Outcome
Three workstreams converge on one secure, recoverable cash-sale slice and evidence-backed production qualification.

## Scope
Frozen contracts, BFF/auth/use cases, operational schema/RLS, Dexie/update coordination, CI, integration evidence and release qualification.

## Out of Scope
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes; full offline settlement, split tender, independent pricing/inventory engines and target-peer infrastructure in P0.

## Canonical Owners
POS operational state in Supabase; provider facts remain with Woo/payment provider; local journal is intent, not paid sale truth.

## Inputs
Current ADRs, canonical schema/ports, normalized bridge responses, payment verification, frontend feature contracts, verified live environment facts.

## Outputs
Frozen contracts, BFF/auth/use cases, operational schema/RLS, Dexie/update coordination, CI, integration evidence and release qualification.

## File Ownership
apps/pos-web/src/core/**; apps/pos-web/src/server/**; apps/pos-web/src/config/**; apps/pos-web/src/app/**; apps/pos-web/src/local/**; apps/pos-web/public/**; supabase/**; docs/**; scripts/**; .github/**; .cursor/**; root control/config; tests/integration/**; tests/contracts/**; tests/e2e/**. See BOUNDARIES.md for exact root-relative interpretation.

## Protected / Forbidden Files
WS1 feature/UI files and WS2 plugin implementation except an explicitly recorded integration delegation; source artifact bytes. No competitive central edits. Record a scoped delegation before crossing ownership.

## Dependencies
CP-01/02/03 freeze authority and v1. CP-05 creates shared app/toolchain; CP-04 verifies live facts. BR-05 gates live transactional checkout. Task-specific dependencies below are mandatory; no hidden cross-workstream dependency.

## Milestones
1. Control plane and contract freeze.
2. Single-owner toolchain/scaffold and environment validation.
3. POS schema/RLS/auth/BFF health.
4. Journal, payment/finalization orchestration and integration.
5. Recovery, security, rehearsal and controlled release.

## Task Sequence
CP-01 → CP-02 → CP-03 → CP-04 → CP-05 → CORE-01 → CORE-02 → CORE-03 → CORE-04 → CORE-05 → CORE-06 → PAY-01 → RT-01 → CORE-07 → QA-01 → REL-01. Full execution contracts are in TASKS.md. CP-03/FE-01/BR-01/CORE work can proceed in distinct files once their stated inputs exist.

## Integration Points
H0–4 authority/contracts/scaffold; H4–12 browser/BFF/providers plus pricing parity; H12–28 one cash-sale slice; H28–44 electronic/returns/shift/PWA; H44–60 failures/rehearsal/pilot. WS3 owns composition and merge order; stage small PRs every few hours.

## Test Requirements
Foundation: `python3 scripts/verify_control_plane.py`. After scaffold: python3 scripts/verify_control_plane.py; pnpm --dir apps/pos-web lint; pnpm --dir apps/pos-web typecheck; pnpm --dir apps/pos-web test; pnpm --dir apps/pos-web build; supabase db reset --local; supabase test db; pnpm --dir apps/pos-web test:e2e. Match tests to risk and register actual commands in TOOLCHAIN.md. Staging and hardware evidence are distinct from unit/mock results; record device/configuration/commit/date and redacted artifacts.

## Failure Cases
Cross-tenant/register access; service-role bypass; migration race; stale session; duplicate callback; provider paid/Woo pending; Woo completed/POS unavailable; disk quota/migration block; missing backup restore; unknown cutover queue.

## Security Requirements
Server derives scope/actor; grants plus RLS for all exposed tables; test deny paths; service-role adapter still checks authorization; secrets restricted to trusted runtime; independent recovery contact.

## Performance Requirements
Proposed budgets: local projection search p95 ≤100 ms; BFF own processing p95 ≤200 ms excluding provider time; quote end-to-end measured by WS2; bounded request timeouts and reconciliation backlog alerts. These are proposed acceptance budgets for the sprint, not measured facts; lead may revise only with recorded reason and UX impact.

## Definition of Done
Owned task acceptance passes; no unapproved file or contract changes; schema/type/lint/unit checks pass where available; relevant runtime proof attached; assumptions and limitations explicit; reviewer accepts. Done = evidence.

## STOP / Escalation Conditions
Any duplicate commercial truth, missing provider contract, unsafe RLS/data access, unproven cash/payment/stock invariant or missing human production approval. Stop only the affected operation; continue authorized independent work. Do not use escalation to request permission already granted in the task.

## Handoff Requirements
Use HANDOFF.md and report exact task/branch/commit(s), files, contracts, migrations, ADRs, commands/results, runtime verification, assumptions/limitations, risks, reviewer and next task. Attach pricing/RLS/device/failure evidence as appropriate. Never say only 'implemented successfully'.
